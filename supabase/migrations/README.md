# Migrations

## Read this before connecting the GitHub integration

The production database is project `tyhhtbtxdwxjcziwmrpx`. Most versions in
`supabase_migrations.schema_migrations` were applied from the SQL editor and
have no file in this directory. Supabase skips a version that is already
recorded, so a filename has to match the live version or the next `db push`
will run it again as a new migration. The two cron files below were recorded
on the live deploy as `20261019130555` and `20261019130603`.

| File | Live database |
|---|---|
| `20260730222009_security_hardening.sql` | Applied |
| `20260731173419_freelancer_workflow_features.sql` | Applied |
| `20260801023428_track_billing_period.sql` | Applied |
| `20260801030250_lock_down_function_execute_grants.sql` | Applied. The file used to be named `20260801041500_…`. It was renamed to the live version so it is not applied a second time. |
| `20260801145756_local_benchmark.sql` | Already recorded. The file is comments only. The original SQL was not saved, so this file does not invent tables. Push skips it because the version is already in `schema_migrations`. |
| `20261019024229_proof_desk_watch.sql` | Applied. The file used to be named `20261019020000_…`. It was renamed to the live version. |
| `20261019030653_harden_proofs_access.sql` | Applied. The file used to be named `20261019024658_…`. It was renamed to the live version. |
| `20261019130555_recheck_saved_prospects.sql` | Applied. The file used to be named `20261019035639_…`. It was renamed to the live version. Schedules a daily call to `recheck-saved`. |
| `20261019130603_desk_notices_and_digest.sql` | Applied. The file used to be named `20261019044856_…`. It was renamed to the live version. Adds the digest opt-in, notices, proof-page replies, saved searches, and the morning job. |
| `20261019142000_recheck_secret_from_vault.sql` | **Not applied.** Lets `service_role` read the Vault cron secret through `private`. No secret in the file. |

`20260801040000_drop_aimediabot_schemas.sql` is **not in this folder**. It was
never applied. The `aimediabot` and `analytics` schemas were already gone from
`pg_namespace` on 19 Oct 2026, and `aimediabot.config` had 6 rows when the
file was written. The statements are kept in `supabase/archive/`. Do not move
that file back here. `supabase db push` does not read the archive, so it
cannot run that drop.

### What `supabase db push` does now

Push applies every file in this directory whose version is missing, oldest
first, and skips versions already recorded. The drop file is no longer one of
those. The placeholder `20260801145756_local_benchmark.sql` matches a version
that is already recorded, so push does not run it.

The two cron files are recorded under the versions above, so push skips them.
One file is still unrecorded, and push **will apply it**:

1. `20261019142000_recheck_secret_from_vault.sql` — adds `private.read_recheck_cron_secret` and a service-role-only public wrapper. It does not drop anything and it does not print the secret.

Do not `db reset --linked` against production.

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
branch. The comment-only `local_benchmark` file does not recreate whatever
that version originally built.

### Fixing it

Squash the real schema into a baseline, using the CLI so the dump is exact
rather than hand-written:

```bash
supabase link --project-ref tyhhtbtxdwxjcziwmrpx
supabase db pull            # writes a baseline migration of the live schema
```

Commit what that produces. Once a baseline exists, enable branching.
