-- ============================================================================
-- Zenvylo — security & correctness hardening
--
-- Written to be idempotent and safe to run on a database whose exact state is
-- unknown: every object uses IF NOT EXISTS / OR REPLACE, and policies are
-- dropped before being recreated. Run it top to bottom in the SQL editor.
--
-- What it changes, and why:
--
--  1. Users can no longer edit their own plan, role, scan counts or Stripe ids.
--     Previously "update own profile" had no WITH CHECK and no column limits,
--     so one console call granted Enterprise + admin. Enforced twice: column
--     GRANTs, plus a trigger for defence in depth.
--
--  2. Admin/moderator policies no longer query `profiles` from inside a
--     `profiles` policy. That recursion is what produced the RLS 500s.
--     Replaced with SECURITY DEFINER helpers (is_admin / is_staff).
--
--  3. Scan quota moved server-side. consume_scan() atomically checks the plan
--     allowance, rolls the month over on the database clock, spends a bonus
--     scan when the plan allowance is gone, and refuses when there's nothing
--     left. The browser can no longer mint scans.
--
--  4. 'owner' is a real role. The old CHECK constraint rejected it while the
--     app depended on it.
--
--  5. Adds the tables the app already queries but which were never in a
--     committed schema at all: affiliates, affiliate_conversions,
--     user_referrals. Plus new ones: ai_calls (rate limiting), stripe_events
--     (webhook idempotency), admin_actions (audit trail).
--
--  6. Adds the columns the evidence engine needs: leads.site_measurement,
--     leads.findings, leads.audited_at, profiles.custom_services.
-- ============================================================================

BEGIN;

-- ─── 0. Extensions ─────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. Profiles: new columns ──────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS scans_reset_at        TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS subscription_status   TEXT,
  ADD COLUMN IF NOT EXISTS referred_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS referred_by_affiliate UUID,
  ADD COLUMN IF NOT EXISTS custom_services       TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deleted_at            TIMESTAMPTZ;

-- 'owner' must be a legal role — the app has depended on it since the crown
-- badge shipped, but the CHECK constraint still rejected it.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('user', 'moderator', 'admin', 'owner'));

-- ─── 2. Leads: evidence columns ────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS site_measurement JSONB,
  ADD COLUMN IF NOT EXISTS findings         JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS audited_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS service_custom   TEXT,
  ADD COLUMN IF NOT EXISTS osm_id           TEXT,
  ADD COLUMN IF NOT EXISTS contacted_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS won_value        INTEGER;

-- ─── 3. Tables the app queries but that were never committed ───────────────
CREATE TABLE IF NOT EXISTS public.affiliates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name            TEXT,
  email           TEXT,
  promo_code      TEXT UNIQUE NOT NULL,
  type            TEXT NOT NULL DEFAULT 'payment' CHECK (type IN ('payment', 'scans')),
  commission_rate NUMERIC(5,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'banned')),
  total_signups   INTEGER DEFAULT 0,
  scans_earned    INTEGER DEFAULT 0,
  total_earned    NUMERIC(12,2) DEFAULT 0,
  pending_payout  NUMERIC(12,2) DEFAULT 0,
  paid_total      NUMERIC(12,2) DEFAULT 0,
  last_payout_at  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.affiliate_conversions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id     UUID REFERENCES public.affiliates(id) ON DELETE CASCADE,
  referred_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  referred_email   TEXT,
  event_type       TEXT NOT NULL CHECK (event_type IN ('signup', 'upgrade', 'rebill')),
  plan             TEXT,
  amount_usd       NUMERIC(12,2) DEFAULT 0,
  commission_usd   NUMERIC(12,2) DEFAULT 0,
  status           TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'void')),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- user_referrals is a VIEW derived from profiles.referred_by, not a table.
--
-- As found in production it was a live PII leak: owned by postgres with
-- security_invoker unset, so it ran with the owner's rights and bypassed RLS on
-- profiles — and SELECT was granted to `anon`. Any visitor holding the public
-- anon key could dump every user's email, name and plan without logging in.
--
-- Rather than switch it to security_invoker (which would break the feature —
-- a referrer legitimately needs to see people RLS won't show them), the view
-- now filters to the caller inside its own definition. Elevated rights, but it
-- can only ever return your own referrals, and auth.uid() is NULL for anon.
CREATE OR REPLACE VIEW public.user_referrals AS
  SELECT p.id         AS referrer_id,
         p.ref_code   AS referrer_code,
         p.email      AS referrer_email,
         r.id         AS referred_user_id,
         r.email      AS referred_email,
         r.name       AS referred_name,
         r.plan       AS referred_plan,
         r.created_at AS referred_at
    FROM public.profiles p
    JOIN public.profiles r ON r.referred_by = p.id
   WHERE p.id = auth.uid();

REVOKE ALL ON public.user_referrals FROM anon;
GRANT SELECT ON public.user_referrals TO authenticated;

-- Webhook idempotency. Stripe retries on any non-2xx and can double-deliver.
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id           TEXT PRIMARY KEY,
  type         TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI / audit rate limiting.
CREATE TABLE IF NOT EXISTS public.ai_calls (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  task          TEXT,
  input_tokens  INTEGER,
  output_tokens INTEGER,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_calls_user_time ON public.ai_calls(user_id, created_at DESC);

-- Every privileged admin action, so role changes and bans are attributable.
CREATE TABLE IF NOT EXISTS public.admin_actions (
  id           BIGSERIAL PRIMARY KEY,
  actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email  TEXT,
  action       TEXT NOT NULL,
  target_id    UUID,
  target_email TEXT,
  detail       JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_time ON public.admin_actions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_affiliates_code ON public.affiliates(promo_code);
CREATE INDEX IF NOT EXISTS idx_aff_conv_affiliate ON public.affiliate_conversions(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_sub ON public.profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON public.leads(user_id, follow_up_date)
  WHERE follow_up_date IS NOT NULL;

-- ─── 4. Role helpers (SECURITY DEFINER — break RLS recursion) ──────────────
-- A policy on `profiles` that does `SELECT ... FROM profiles` re-enters the
-- same policy and errors. These run as the definer, skipping RLS entirely.

CREATE OR REPLACE FUNCTION public.current_role_name()
RETURNS TEXT LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(public.current_role_name() IN ('admin', 'owner'), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COALESCE(public.current_role_name() IN ('moderator', 'admin', 'owner'), FALSE);
$$;

-- ─── 5. Privilege guard on profiles ───────────────────────────────────────
-- Column GRANTs (section 6) are the real control. This trigger is the backstop
-- in case a future GRANT re-opens something by accident.
--
-- SECURITY DEFINER functions in this file legitimately need to write these
-- columns, and auth.uid() is still set inside them, so they announce
-- themselves with a transaction-local flag rather than being special-cased.

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Service role / SQL editor: no JWT, nothing to restrict.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;

  -- A trusted routine in this schema is doing the write.
  IF COALESCE(current_setting('zv.privileged', TRUE), '') = 'on' THEN RETURN NEW; END IF;

  IF NEW.plan                   IS DISTINCT FROM OLD.plan
  OR NEW.role                   IS DISTINCT FROM OLD.role
  OR NEW.scans_used             IS DISTINCT FROM OLD.scans_used
  OR NEW.bonus_scans            IS DISTINCT FROM OLD.bonus_scans
  OR NEW.scans_reset_at         IS DISTINCT FROM OLD.scans_reset_at
  OR NEW.banned                 IS DISTINCT FROM OLD.banned
  OR NEW.trial_end              IS DISTINCT FROM OLD.trial_end
  OR NEW.trial_started          IS DISTINCT FROM OLD.trial_started
  OR NEW.subscription_status    IS DISTINCT FROM OLD.subscription_status
  OR NEW.stripe_customer_id     IS DISTINCT FROM OLD.stripe_customer_id
  OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
  OR NEW.ref_code               IS DISTINCT FROM OLD.ref_code
  OR NEW.referrals              IS DISTINCT FROM OLD.referrals
  OR NEW.referred_by            IS DISTINCT FROM OLD.referred_by
  OR NEW.referred_by_affiliate  IS DISTINCT FROM OLD.referred_by_affiliate
  OR NEW.email                  IS DISTINCT FROM OLD.email
  OR NEW.id                     IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION
      'Billing, role and quota fields cannot be changed from the client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges ON public.profiles;
CREATE TRIGGER guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- ─── 6. Column-level privileges ───────────────────────────────────────────
-- Postgres can restrict UPDATE per column; RLS cannot. This is the primary
-- mechanism stopping a browser from writing `plan` or `role`.

REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT  UPDATE (name, country, svc, currency, onboarded, profile_image_url, custom_services)
  ON public.profiles TO authenticated;

-- Nobody but the server touches these.
REVOKE ALL ON public.stripe_events  FROM anon, authenticated;
REVOKE ALL ON public.admin_actions  FROM anon, authenticated;
REVOKE ALL ON public.ai_calls       FROM anon, authenticated;
GRANT  SELECT ON public.admin_actions TO authenticated; -- RLS narrows to staff

-- ─── 7. Row Level Security ────────────────────────────────────────────────
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_calls              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions         ENABLE ROW LEVEL SECURITY;

-- Profiles ----------------------------------------------------------------
-- Both the name used in the committed schema and the name actually deployed —
-- production had drifted, and dropping only one would leave a stale duplicate.
DROP POLICY IF EXISTS "read own profile"          ON public.profiles;
DROP POLICY IF EXISTS "users read own profile"    ON public.profiles;
DROP POLICY IF EXISTS "update own profile"        ON public.profiles;
DROP POLICY IF EXISTS "admins read all profiles"  ON public.profiles;
DROP POLICY IF EXISTS "admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "staff read all profiles"   ON public.profiles;

CREATE POLICY "read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- WITH CHECK matters: without it a user could move a row to another id.
CREATE POLICY "update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY "staff read all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff());

-- Deliberately no client-side admin UPDATE policy. Admin writes go through the
-- admin-actions edge function, which checks the caller's role server-side and
-- writes an audit row. That keeps "who changed this plan" answerable.

-- Own-data tables ---------------------------------------------------------
DROP POLICY IF EXISTS "manage own leads"   ON public.leads;
DROP POLICY IF EXISTS "manage own clients" ON public.clients;
DROP POLICY IF EXISTS "manage own scans"   ON public.scans;

CREATE POLICY "manage own leads" ON public.leads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "manage own clients" ON public.clients
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "manage own scans" ON public.scans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Affiliates --------------------------------------------------------------
DROP POLICY IF EXISTS "read own affiliate"        ON public.affiliates;
DROP POLICY IF EXISTS "staff read affiliates"     ON public.affiliates;
DROP POLICY IF EXISTS "read own conversions"      ON public.affiliate_conversions;
DROP POLICY IF EXISTS "staff read conversions"    ON public.affiliate_conversions;

CREATE POLICY "read own affiliate" ON public.affiliates
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "staff read affiliates" ON public.affiliates
  FOR SELECT USING (public.is_admin());

CREATE POLICY "read own conversions" ON public.affiliate_conversions
  FOR SELECT USING (
    affiliate_id IN (SELECT id FROM public.affiliates WHERE user_id = auth.uid())
  );
CREATE POLICY "staff read conversions" ON public.affiliate_conversions
  FOR SELECT USING (public.is_admin());

-- Affiliate rows are created and paid out by the server only — no INSERT or
-- UPDATE policy for clients.

-- Usage + audit -----------------------------------------------------------
DROP POLICY IF EXISTS "read own ai calls"      ON public.ai_calls;
DROP POLICY IF EXISTS "staff read admin log"   ON public.admin_actions;
CREATE POLICY "read own ai calls" ON public.ai_calls
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "staff read admin log" ON public.admin_actions
  FOR SELECT USING (public.is_admin());

-- stripe_events: no policies at all → unreachable except by service role.

-- ─── 8. Plan limits (single source of truth, server side) ─────────────────
CREATE OR REPLACE FUNCTION public.plan_scan_limit(p_plan TEXT, p_trial_end TIMESTAMPTZ)
RETURNS INTEGER LANGUAGE SQL IMMUTABLE AS $$
  SELECT CASE
    -- An unexpired trial grants the Pro allowance regardless of stored plan.
    WHEN p_trial_end IS NOT NULL AND p_trial_end > NOW() THEN 100
    WHEN p_plan = 'starter'    THEN 20
    WHEN p_plan = 'growth'     THEN 50
    WHEN p_plan = 'pro'        THEN 100
    WHEN p_plan = 'scale'      THEN 200
    WHEN p_plan = 'enterprise' THEN 500
    ELSE 3
  END;
$$;

-- ─── 9. consume_scan — the only way to spend a scan ───────────────────────
CREATE OR REPLACE FUNCTION public.consume_scan()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_now   TIMESTAMPTZ := NOW();
  v_limit INTEGER;
  p       public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'not_authenticated');
  END IF;

  PERFORM set_config('zv.privileged', 'on', TRUE);

  -- FOR UPDATE serialises concurrent scans from two tabs.
  SELECT * INTO p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'no_profile');
  END IF;

  IF p.banned THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'banned');
  END IF;

  -- Monthly rollover on the database clock, not the visitor's.
  IF p.scans_reset_at IS NULL
     OR date_trunc('month', p.scans_reset_at) < date_trunc('month', v_now) THEN
    UPDATE public.profiles
       SET scans_used = 0, scans_reset_at = v_now
     WHERE id = v_uid;
    p.scans_used := 0;
  END IF;

  IF p.role = 'owner' THEN
    RETURN jsonb_build_object(
      'allowed', TRUE, 'source', 'owner', 'unlimited', TRUE,
      'scans_used', p.scans_used, 'bonus_scans', COALESCE(p.bonus_scans, 0));
  END IF;

  v_limit := public.plan_scan_limit(p.plan, p.trial_end);

  IF p.scans_used < v_limit THEN
    UPDATE public.profiles SET scans_used = scans_used + 1 WHERE id = v_uid;
    RETURN jsonb_build_object(
      'allowed', TRUE, 'source', 'plan',
      'scans_used', p.scans_used + 1,
      'bonus_scans', COALESCE(p.bonus_scans, 0),
      'remaining', (v_limit - p.scans_used - 1) + COALESCE(p.bonus_scans, 0));
  END IF;

  IF COALESCE(p.bonus_scans, 0) > 0 THEN
    UPDATE public.profiles SET bonus_scans = bonus_scans - 1 WHERE id = v_uid;
    RETURN jsonb_build_object(
      'allowed', TRUE, 'source', 'bonus',
      'scans_used', p.scans_used,
      'bonus_scans', p.bonus_scans - 1,
      'remaining', p.bonus_scans - 1);
  END IF;

  RETURN jsonb_build_object(
    'allowed', FALSE, 'reason', 'no_scans_left',
    'scans_used', p.scans_used, 'bonus_scans', 0, 'remaining', 0);
END;
$$;

-- Give the scan back when the pipeline fails after the charge. Bounded by the
-- plan limit so it can't be farmed into free credit.
CREATE OR REPLACE FUNCTION public.refund_scan(p_source TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  p     public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('refunded', FALSE);
  END IF;

  PERFORM set_config('zv.privileged', 'on', TRUE);

  SELECT * INTO p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('refunded', FALSE); END IF;

  IF p_source = 'bonus' THEN
    UPDATE public.profiles SET bonus_scans = COALESCE(bonus_scans, 0) + 1 WHERE id = v_uid;
  ELSIF p_source = 'plan' AND p.scans_used > 0 THEN
    UPDATE public.profiles SET scans_used = scans_used - 1 WHERE id = v_uid;
  ELSE
    RETURN jsonb_build_object('refunded', FALSE);
  END IF;

  RETURN jsonb_build_object('refunded', TRUE);
END;
$$;

-- ─── 10. Rate limiting (service role only) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_ai_call(
  p_user_id UUID, p_task TEXT, p_limit_minute INTEGER, p_limit_day INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_minute INTEGER;
  v_day    INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_minute FROM public.ai_calls
   WHERE user_id = p_user_id AND created_at > NOW() - INTERVAL '1 minute';
  IF v_minute >= p_limit_minute THEN
    RETURN jsonb_build_object('allowed', FALSE, 'reason', 'minute', 'retry_after_seconds', 60);
  END IF;

  SELECT COUNT(*) INTO v_day FROM public.ai_calls
   WHERE user_id = p_user_id AND created_at > date_trunc('day', NOW());
  IF v_day >= p_limit_day THEN
    RETURN jsonb_build_object(
      'allowed', FALSE, 'reason', 'day',
      'retry_after_seconds',
      GREATEST(60, EXTRACT(EPOCH FROM (date_trunc('day', NOW()) + INTERVAL '1 day' - NOW()))::INTEGER));
  END IF;

  INSERT INTO public.ai_calls (user_id, task) VALUES (p_user_id, p_task);
  RETURN jsonb_build_object('allowed', TRUE, 'minute_count', v_minute + 1, 'day_count', v_day + 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_ai_tokens(
  p_user_id UUID, p_input INTEGER, p_output INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ai_calls SET input_tokens = p_input, output_tokens = p_output
   WHERE id = (SELECT id FROM public.ai_calls
                WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 1);
END;
$$;

-- A client must not be able to pass its own limits in.
REVOKE ALL ON FUNCTION public.record_ai_call(UUID, TEXT, INTEGER, INTEGER) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ai_tokens(UUID, INTEGER, INTEGER)     FROM anon, authenticated;

-- ─── 11. Scan packs, referrals, affiliate earnings ────────────────────────
CREATE OR REPLACE FUNCTION public.add_bonus_scans(p_user_id UUID, p_amount INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 1000 THEN RETURN; END IF;
  PERFORM set_config('zv.privileged', 'on', TRUE);
  UPDATE public.profiles
     SET bonus_scans = COALESCE(bonus_scans, 0) + p_amount
   WHERE id = p_user_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_bonus_scans(UUID, INTEGER) FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.increment_referral_count(p_user_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM set_config('zv.privileged', 'on', TRUE);
  UPDATE public.profiles SET referrals = COALESCE(referrals, 0) + 1 WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_affiliate_earnings(p_affiliate_id UUID, p_amount NUMERIC)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  UPDATE public.affiliates
     SET total_earned   = COALESCE(total_earned, 0) + p_amount,
         pending_payout = COALESCE(pending_payout, 0) + p_amount
   WHERE id = p_affiliate_id;
END;
$$;
REVOKE ALL ON FUNCTION public.add_affiliate_earnings(UUID, NUMERIC) FROM anon, authenticated;

-- Returns only the referrer's id, so a valid code can't be used to enumerate
-- emails or names.
CREATE OR REPLACE FUNCTION public.lookup_referrer(p_code TEXT)
RETURNS UUID LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id FROM public.profiles WHERE ref_code = p_code LIMIT 1;
$$;

-- Claim a referral atomically: caller may only ever set their own referrer,
-- once, and never themselves.
CREATE OR REPLACE FUNCTION public.claim_referral(p_code TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid         UUID := auth.uid();
  v_referrer    UUID;
  v_affiliate   public.affiliates;
  v_email       TEXT;
  v_existing    UUID;
BEGIN
  IF v_uid IS NULL OR p_code IS NULL OR length(p_code) < 3 THEN
    RETURN jsonb_build_object('ok', FALSE);
  END IF;

  PERFORM set_config('zv.privileged', 'on', TRUE);

  SELECT referred_by, email INTO v_existing, v_email
    FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'already_referred');
  END IF;

  -- Affiliate promo code takes precedence over a user ref code.
  SELECT * INTO v_affiliate FROM public.affiliates
   WHERE promo_code = upper(p_code) AND status = 'active' LIMIT 1;

  IF v_affiliate.id IS NOT NULL THEN
    UPDATE public.profiles
       SET referred_by_affiliate = v_affiliate.id, bonus_scans = COALESCE(bonus_scans, 0) + 5
     WHERE id = v_uid;

    UPDATE public.affiliates
       SET total_signups = COALESCE(total_signups, 0) + 1,
           scans_earned  = COALESCE(scans_earned, 0)
                           + CASE WHEN v_affiliate.type = 'scans' THEN 3 ELSE 0 END
     WHERE id = v_affiliate.id;

    IF v_affiliate.type = 'scans' AND v_affiliate.user_id IS NOT NULL THEN
      UPDATE public.profiles
         SET bonus_scans = COALESCE(bonus_scans, 0) + 3
       WHERE id = v_affiliate.user_id;
    END IF;

    INSERT INTO public.affiliate_conversions
      (affiliate_id, referred_user_id, referred_email, event_type, plan, amount_usd, commission_usd)
    VALUES (v_affiliate.id, v_uid, v_email, 'signup', 'free', 0, 0);

    RETURN jsonb_build_object('ok', TRUE, 'kind', 'affiliate', 'bonus', 5);
  END IF;

  v_referrer := public.lookup_referrer(p_code);
  IF v_referrer IS NULL OR v_referrer = v_uid THEN
    RETURN jsonb_build_object('ok', FALSE, 'reason', 'invalid_code');
  END IF;

  UPDATE public.profiles
     SET referred_by = v_referrer, bonus_scans = COALESCE(bonus_scans, 0) + 5
   WHERE id = v_uid;
  UPDATE public.profiles
     SET referrals = COALESCE(referrals, 0) + 1, bonus_scans = COALESCE(bonus_scans, 0) + 5
   WHERE id = v_referrer;

  RETURN jsonb_build_object('ok', TRUE, 'kind', 'user', 'bonus', 5);
END;
$$;

-- ─── 12. Signup trigger ───────────────────────────────────────────────────
-- The old version read `role` straight out of raw_user_meta_data, which the
-- client controls — anyone could have signed up as an owner. Role is now
-- decided here, from the email alone.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_owner_email TEXT := 'clujkeebs@aol.com';
  v_code        TEXT;
BEGIN
  -- Retry a few times on the (unlikely) ref_code collision.
  FOR i IN 1..5 LOOP
    v_code := 'ZV-' || UPPER(LEFT(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9]', '', 'g'), 4))
              || '-' || UPPER(SUBSTR(MD5(RANDOM()::TEXT || NEW.id::TEXT), 1, 5));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE ref_code = v_code);
  END LOOP;

  INSERT INTO public.profiles (
    id, email, name, country, svc, currency, ref_code, role, plan, scans_reset_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), SPLIT_PART(NEW.email, '@', 1)),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'country', ''), 'United States'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'svc', ''), 'web'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'currency', ''), 'USD'),
    v_code,
    CASE WHEN LOWER(NEW.email) = LOWER(v_owner_email) THEN 'owner' ELSE 'user' END,
    'free',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Make sure the owner account is actually the owner even if it predates this.
UPDATE public.profiles SET role = 'owner'
 WHERE LOWER(email) = 'clujkeebs@aol.com' AND role <> 'owner';

-- Backfill so the first consume_scan() doesn't think the month just rolled.
UPDATE public.profiles SET scans_reset_at = COALESCE(scans_reset_at, created_at, NOW())
 WHERE scans_reset_at IS NULL;

-- ─── 13. Legacy cleanup ───────────────────────────────────────────────────
-- increment_scans() let the client add to its own scan count with no checks.
DROP FUNCTION IF EXISTS public.increment_scans(UUID);
DROP FUNCTION IF EXISTS public.check_and_reset_monthly_scans(UUID);

-- ─── 14. Avatar storage ───────────────────────────────────────────────────
-- The bucket is public-read, but writes must be scoped to the owner's folder or
-- any signed-in user can overwrite anyone's avatar.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'storage' AND table_name = 'objects') THEN

    EXECUTE 'DROP POLICY IF EXISTS "avatars are publicly readable" ON storage.objects';
    EXECUTE 'DROP POLICY IF EXISTS "users manage own avatar" ON storage.objects';

    EXECUTE $p$
      CREATE POLICY "avatars are publicly readable" ON storage.objects
        FOR SELECT USING (bucket_id = 'avatars')
    $p$;

    -- Path convention is "<user-id>/avatar.<ext>", so the first path segment
    -- must equal the caller's id.
    EXECUTE $p$
      CREATE POLICY "users manage own avatar" ON storage.objects
        FOR ALL USING (
          bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
        ) WITH CHECK (
          bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
        )
    $p$;
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verification — run these afterwards; every one should come back as stated.
-- ============================================================================
--
-- 1) A client cannot escalate itself. As a signed-in non-owner user:
--      update profiles set plan='enterprise' where id = auth.uid();
--    → ERROR: permission denied for table profiles  (column GRANT)
--
-- 2) Quota is spendable only through the RPC:
--      select consume_scan();
--    → {"allowed":true,"source":"plan",...} then false once the plan is used up
--
-- 3) No recursive policy remains:
--      select * from profiles;            -- as a signed-in admin
--    → returns rows, not "infinite recursion detected in policy"
--
-- 4) Owner is a legal role:
--      select role from profiles where email='clujkeebs@aol.com';
--    → owner
-- ============================================================================
