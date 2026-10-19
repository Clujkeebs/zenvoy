-- APPLIED on the live database as version 20261019132911.
-- This file used to be named 20261019142000_recheck_secret_from_vault.sql.
-- The rename matches schema_migrations so push does not run it again.
-- Do not edit the statements below.
--
-- recheck-saved and daily-digest already compare x-recheck-secret to the
-- RECHECK_CRON_SECRET env var. The same value is stored in Vault as
-- recheck_cron_secret, which is what the cron jobs send. This lets those
-- two functions read that Vault value when the env var is missing.
--
-- private is not in the Data API exposed schemas. Keep it off that list.
-- The privileged read is SECURITY DEFINER and lives there. anon and
-- authenticated cannot execute it. service_role can.
--
-- PostgREST does not route to a schema that is not exposed, so the edge
-- functions call public.read_recheck_cron_secret. That wrapper is
-- SECURITY INVOKER and is also granted only to service_role. It does not
-- bypass privileges itself. It delegates to the private function, which
-- the service role is allowed to run. The secret is returned only to a
-- caller that already holds the service role key. The constant-time
-- compare stays in the edge functions. This file contains no secret.

CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO service_role;

CREATE OR REPLACE FUNCTION private.read_recheck_cron_secret()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'recheck_cron_secret'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION private.read_recheck_cron_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.read_recheck_cron_secret() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION private.read_recheck_cron_secret() TO service_role;

CREATE OR REPLACE FUNCTION public.read_recheck_cron_secret()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT private.read_recheck_cron_secret();
$$;

REVOKE ALL ON FUNCTION public.read_recheck_cron_secret() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_recheck_cron_secret() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_recheck_cron_secret() TO service_role;
