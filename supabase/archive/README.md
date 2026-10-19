# Archived SQL

These files are kept so the history is not thrown away. They are **not**
migrations. `supabase db push` only reads `supabase/migrations`, so nothing
in this folder runs.

## `20260801040000_drop_aimediabot_schemas.sql`

This file was never applied. On 19 Oct 2026 the live database
(`tyhhtbtxdwxjcziwmrpx`) had no `aimediabot` or `analytics` schema in
`pg_namespace`, while the migrations that created them were still recorded.
The schemas were removed outside this file.

When the file was written, `aimediabot.config` had 6 rows. Applying it would
record a drop that did not happen here, and it would delete those schemas
again if a backup that still has the rows were restored.

Leave the file here. Do not delete it, and do not move it back into
`supabase/migrations`.
