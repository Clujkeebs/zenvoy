-- NOT APPLIED. Do not run this file.
-- Version 20260801040000 is not in the live schema_migrations table.
-- `supabase db push` would apply it, because every unrecorded version runs.
--
-- It drops the aimediabot and analytics schemas. When this file was written,
-- aimediabot.config held 6 settings rows and every other table in those
-- schemas was empty. On 19 Oct 2026 those two schemas were not in
-- pg_namespace, while their create migrations were still recorded, so they
-- were removed outside this file. Leave the file here. Do not apply it:
-- applying it would record the drop, and would delete the schemas again if
-- a backup that still has those 6 rows is restored.
--
-- Remove the AI media bot and its social analytics schemas. Neither was used
-- by Zenvylo. Verified before dropping: no foreign keys crossed into
-- public/auth, no edge function referenced them, and every table was empty
-- except aimediabot.config (6 settings rows).
DROP SCHEMA IF EXISTS aimediabot CASCADE;
DROP SCHEMA IF EXISTS analytics  CASCADE;
