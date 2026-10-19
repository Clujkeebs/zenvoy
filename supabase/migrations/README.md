# Migrations

## Read this before connecting the GitHub integration

The production database is project `tyhhtbtxdwxjcziwmrpx`. On 19 Oct 2026 it
had **36** versions in `supabase_migrations.schema_migrations`. Most of those
were applied from the SQL editor and have no file in this directory. Supabase
skips a version that is already recorded, so a filename has to match the live
version or the next `db push` will run it again as a new migration.

| File | Live database |
|---|---|
| `20260730222009_security_hardening.sql` | Applied |
| `20260731173419_freelancer_workflow_features.sql` | Applied |
| `20260801023428_track_billing_period.sql` | Applied |
| `20260801030250_lock_down_function_execute_grants.sql` | Applied. The file used to be named `20260801041500_…`. It was renamed to the live version so it is not applied a second time. |
| `20260801040000_drop_aimediabot_schemas.sql` | **Not applied. Do not apply it.** It `DROP SCHEMA`s `aimediabot` and `analytics`. When it was written, `aimediabot.config` had **6 rows**. On 19 Oct 2026 those schemas were already absent from `pg_namespace` (their create migrations are still recorded), so they were removed outside this file. Leave the file. Do not delete it and do not run it. |
| `20261019024229_proof_desk_watch.sql` | Applied. The file used to be named `20261019020000_…`. It was renamed to the live version. |
| `20261019024658_harden_proofs_access.sql` | **Not applied.** Fixes the new `proofs` advisor warnings. Review it, then apply it on its own. |

Live version `20260801145756_local_benchmark` is recorded and has **no file**
here. Do not invent one.

### Do not `supabase db push` yet

Push applies every file whose version is missing, oldest first. That would run
`20260801040000_drop_aimediabot_schemas.sql` before the new proofs hardening.
Apply `20261019024658_harden_proofs_access.sql` by itself after review.

⚠️ Never rename an applied file to a version that is not already in
`schema_migrations`. The version prefix is what stops a re-run.

## Branching is NOT safe yet

Preview branches build a database from scratch by replaying this directory. That
will currently fail, for a reason that predates any of this work:

**No migration ever creates the `profiles` table.** It — along with `posts` —
was created by hand in the SQL editor before migration tracking began. Verified:

```sql
select count(*) from supabase_migrations.schema_migrations
 where array_to_string(statements,' ') ~* 'create table (if not exists )?(public\.)?profiles\s*\(';
-- 0
```

So the earliest recorded migration (`20260322181250_add_missing_tables`) opens
with `REFERENCES profiles(id)` against a table that would not exist on a fresh
branch.

### Fixing it

Squash the real schema into a baseline, using the CLI so the dump is exact
rather than hand-written:

```bash
supabase link --project-ref tyhhtbtxdwxjcziwmrpx
supabase db pull            # writes a baseline migration of the live schema
```

Commit what that produces. Once a baseline exists, enable branching.
