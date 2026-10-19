-- Harden the proofs table and the public proof lookup.
-- NOT APPLIED. Review, then run. Do not apply from this change.
--
-- Advisor warnings this fixes on public.proofs:
--   * auth_rls_initplan: auth.uid() was re-checked per row.
--     Wrap it as (select auth.uid()) so Postgres evaluates it once.
--   * unindexed_foreign_keys: proofs.user_id had no covering index.
--
-- get_proof stays callable by anonymous visitors (supabase.rpc('get_proof',
-- { p_id })). The privileged read moves to schema private, which is not in
-- the Data API exposed schemas (the default is public only). Keep private
-- off that list. public.get_proof becomes SECURITY INVOKER, so the
-- "security definer function in an exposed schema" advisor (lints 0028 and
-- 0029) no longer applies to it. The invoker wrapper is what anon and
-- authenticated actually call; it cannot read the table itself.
--
-- The id has to be a verification code (12 hex digits, grouped 4-4-4).
-- That is the only id the proof page issues. A short or ordinary id returns
-- nothing, so a row saved under an easy-to-guess id is not a public document.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.read_proof(p_id TEXT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT payload
  FROM public.proofs
  WHERE id = upper(p_id)
    AND upper(p_id) ~ '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.read_proof(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.read_proof(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_proof(p_id TEXT)
RETURNS JSONB
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.read_proof(p_id);
$$;

REVOKE ALL ON FUNCTION public.get_proof(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_proof(TEXT) TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "owner inserts proofs" ON public.proofs;
CREATE POLICY "owner inserts proofs" ON public.proofs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "owner reads own proofs" ON public.proofs;
CREATE POLICY "owner reads own proofs" ON public.proofs
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_proofs_user_id ON public.proofs (user_id);
