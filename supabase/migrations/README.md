# Migrations

## Read this before connecting the GitHub integration

The production database is at project `tyhhtbtxdwxjcziwmrpx` and has **33
migrations applied**. This directory contains only the three that were written
as files; the other 30 were applied directly and exist only in the database's
`supabase_migrations.schema_migrations` table.

That is safe for **deploying migrations on push**, because Supabase skips any
version already recorded as applied. The filenames here deliberately match the
recorded versions:

| File | Recorded in DB |
|---|---|
| `20260730222009_security_hardening.sql` | ✅ `security_hardening` |
| `20260731173419_freelancer_workflow_features.sql` | ✅ `freelancer_workflow_features` |
| `20260801023428_track_billing_period.sql` | ✅ `track_billing_period` |

⚠️ Never rename these. The version prefix is what stops them being re-applied.

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
