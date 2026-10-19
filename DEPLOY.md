# Deploy Zenvylo

Do these steps in order. This file does not deploy anything. It does not change Stripe prices. Do not put secret values in git.

The live project is `tyhhtbtxdwxjcziwmrpx`. The site is https://zenvylo.app.

## 1. Leave the old drop file alone

`supabase/archive/20260801040000_drop_aimediabot_schemas.sql` was never applied. The schemas were already gone. Do not move that file back into `supabase/migrations`, and do not run it.

`supabase db push` will not see it. Push will apply the two files in the next step, because those versions are not recorded yet.

## 2. Apply the pending migrations

These two files are not on the live database yet. Apply the re-check one first, then the desk one. You can paste each file into the SQL editor, or run `supabase db push` once. Do not `db reset` this project.

1. `supabase/migrations/20261019035639_recheck_saved_prospects.sql`
   Adds the daily re-check job. It does not drop anything. The job errors each morning until step 4 and step 5 are done.
2. `supabase/migrations/20261019044856_desk_notices_and_digest.sql`
   Adds the digest switch, in-app notices, proof-page replies, saved searches, and the morning note job. Same warning: the job errors until the function and the Vault secrets exist.

Files already recorded on the live database, as of 19 Oct 2026, do not need to be applied again:

- `20260730222009_security_hardening.sql`
- `20260731173419_freelancer_workflow_features.sql`
- `20260801023428_track_billing_period.sql`
- `20260801030250_lock_down_function_execute_grants.sql`
- `20260801145756_local_benchmark.sql` (comments only; the version is already recorded)
- `20261019024229_proof_desk_watch.sql`
- `20261019030653_harden_proofs_access.sql`

Preview branches are still unsafe. No migration creates the `profiles` table.

## 3. Frontend environment

Set these for the Vite app. Names only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GA_MEASUREMENT_ID` (optional; analytics stays off until a visitor accepts cookies)

## 4. Function secrets

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform. Set the rest with `supabase secrets set`. Do not print the values.

Required for the desk agent and for scheduled jobs:

- `ANTHROPIC_API_KEY` — Ask your desk. If it is missing, the desk answers from saved records and does not call a model.
- `RECHECK_CRON_SECRET` — 16 characters or more. Used by `recheck-saved` and `daily-digest`. There is not a second cron secret.
- `ALLOWED_ORIGINS` — comma-separated browser origins, for example `https://zenvylo.app,https://www.zenvylo.app`

Optional. If either is missing, the morning job still writes an in-app notice and does not send email:

- `RESEND_API_KEY`
- `DIGEST_FROM`

Stripe is already configured. This checklist does not rotate or edit it. Those names stay as they are:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_GROWTH`
- `STRIPE_PRICE_PRO`
- `STRIPE_PRICE_SCALE`

## 5. Vault names the cron jobs read

In the SQL editor, store the same `RECHECK_CRON_SECRET` and the project URL. The names must be exactly these:

- `recheck_cron_secret`
- `project_url` — value shape `https://PROJECT.supabase.co`

```sql
select vault.create_secret('<the RECHECK_CRON_SECRET value>', 'recheck_cron_secret');
select vault.create_secret('https://PROJECT.supabase.co', 'project_url');
```

## 6. Deploy functions

From this repo, in this order:

```bash
supabase functions deploy audit-site
supabase functions deploy local-benchmark
supabase functions deploy ai-proxy
supabase functions deploy recheck-saved
supabase functions deploy daily-digest
supabase functions deploy audit-interest
```

`audit-site` measures websites. `recheck-saved` and a manual re-check both depend on that measurer, including the timeout, redirect, bot-wall, and non-HTML handling.

`audit-interest` and `daily-digest` and `recheck-saved` are called without a user JWT. `supabase/config.toml` sets `verify_jwt = false` for those three. Each one still checks its own credential: the proof hash, or `RECHECK_CRON_SECRET`.

Stripe stays as it is. Do not change price IDs. If you redeploy these functions with the rest, `config.toml` already turns JWT checks off for the webhook, because Stripe cannot send one. The function still rejects a body whose Stripe signature does not match.

```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
```

`admin-actions` is only needed if you use the admin screen:

```bash
supabase functions deploy admin-actions
```

## 7. Smoke-test the live project

Put these in the environment you run the command from. Do not commit them.

- `SMOKE_SUPABASE_URL` — `https://PROJECT.supabase.co`
- `SMOKE_SUPABASE_ANON_KEY`
- `SMOKE_EMAIL` — an account you can create or sign into. If the project requires email confirmation, confirm it once, then run the command again.
- `SMOKE_PASSWORD`
- `SMOKE_SITE` — optional. Defaults to `https://example.com`

Then:

```bash
npm run smoke
```

The command signs in (or signs up), measures the site, saves a lead, checks a proof document, re-checks that lead, and calls the desk agent. A free account that receives HTTP 402 from the desk agent is a pass: the plan gate worked. The command deletes the smoke lead when it can.

If none of the four `SMOKE_` values are set, the command skips and exits 0. If only some are set, it exits 1.

## 8. Things that are already part of a working project

- The hardening migration in the old deploy notes was renamed. The recorded version is `20260730222009_security_hardening.sql`. Do not look for `20260729000000_hardening.sql`.
- Profile photos need a public Storage bucket named `avatars`. The policies are in the hardening migration. Skip this if the bucket is already there.
- The site is a single-page app. The host must serve `index.html` for unknown paths. Vercel does that for this Vite project.
- `npm run check` runs lint, tests, and the production build.
