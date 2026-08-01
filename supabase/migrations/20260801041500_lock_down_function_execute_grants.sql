-- ============================================================================
-- Close the hole left by revoking from anon/authenticated instead of PUBLIC.
--
-- Postgres grants EXECUTE on every new function to PUBLIC, and anon/
-- authenticated inherit it. The earlier `REVOKE ... FROM anon, authenticated`
-- therefore did nothing. Confirmed exploitable before this migration: a
-- signed-in user could POST /rest/v1/rpc/add_bonus_scans with their own id and
-- 1000, and receive 1000 free scans — defeating the whole quota system.
-- ============================================================================

DO $blk$
DECLARE fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'add_bonus_scans(uuid, integer)',
    'add_affiliate_earnings(uuid, numeric)',
    'record_ai_call(uuid, text, integer, integer)',
    'record_ai_tokens(uuid, integer, integer)',
    'increment_referral_count(uuid)',
    'lookup_referrer(text)',
    'plan_scan_limit(text, timestamptz)',
    'handle_new_user()',
    'guard_profile_privileges()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $blk$;

-- Legacy functions, equally exposed. mark_affiliate_paid let any signed-in
-- user zero out a pending payout.
DO $blk$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname='public' AND p.proname='mark_affiliate_paid') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.mark_affiliate_paid(uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER FUNCTION public.mark_affiliate_paid(uuid) SET search_path = public';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname='public' AND p.proname='is_mod_or_admin') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.is_mod_or_admin(uuid) FROM PUBLIC, anon, authenticated';
    EXECUTE 'ALTER FUNCTION public.is_mod_or_admin(uuid) SET search_path = public';
  END IF;
END $blk$;

-- Deliberately callable by signed-in users: these derive their target from
-- auth.uid(), so they cannot act on anyone else. is_admin/is_staff/
-- current_role_name are evaluated inside RLS policies as the querying user —
-- revoking them would break every staff policy.
REVOKE ALL ON FUNCTION public.consume_scan()       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refund_scan(text)    FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_scan()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_scan(text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

REVOKE ALL ON FUNCTION public.is_admin()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff()          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_role_name() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role_name() TO authenticated;

ALTER FUNCTION public.plan_scan_limit(text, timestamptz) SET search_path = public;

-- user_referrals was SECURITY DEFINER, bypassing RLS. Give referrers a narrow
-- read on the people they referred instead, and let the view run as the caller.
DROP POLICY IF EXISTS "read referred profiles" ON public.profiles;
CREATE POLICY "read referred profiles" ON public.profiles
  FOR SELECT USING (referred_by = auth.uid());

ALTER VIEW public.user_referrals SET (security_invoker = true);

-- Anyone signed in could edit any community group.
DROP POLICY IF EXISTS "update groups" ON public.groups;
CREATE POLICY "update groups" ON public.groups
  FOR UPDATE USING (public.is_staff()) WITH CHECK (public.is_staff());

-- The shared name registry accepted writes from unauthenticated callers.
DROP POLICY IF EXISTS "insert global names" ON public.global_lead_names;
CREATE POLICY "insert global names" ON public.global_lead_names
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Two SELECT policies from different migrations both allowed listing the
-- avatars bucket. One is enough.
DROP POLICY IF EXISTS "public read avatars" ON storage.objects;
