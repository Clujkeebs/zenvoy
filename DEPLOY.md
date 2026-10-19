# Deploy Zenvylo

Do these steps in order. This file does not deploy anything. It does not change Stripe prices. Do not put secret values in git.

The live project is `tyhhtbtxdwxjcziwmrpx`. The site is https://zenvylo.app.

## 1. Leave the old drop file alone

`supabase/archive/20260801040000_drop_aimediabot_schemas.sql` was never applied. The schemas were already gone. Do not move that file back into `supabase/migrations`, and do not run it.

`supabase db push` will not see it.

## 2. Apply the pending migration

The re-check job and the desk job are already recorded. Their files were renamed to those versions. Do not apply them again, and do not look for the old names:

- `20261019130555_recheck_saved_prospects.sql` (was `20261019035639_…`)
- `20261019130603_desk_notices_and_digest.sql` (was `20261019044856_…`)

One file is not recorded yet. Apply it, or run `supabase db push` once. Do not `db reset` this project.

1. `supabase/migrations/20261019142000_recheck_secret_from_vault.sql`
   Lets the service role read the Vault secret named `recheck_cron_secret`. It does not drop anything. Until this is applied, `recheck-saved` and `daily-digest` still need the `RECHECK_CRON_SECRET` env var.

Files already recorded, including the two above, do not need to be applied again:

- `20260730222009_security_hardening.sql`
- `20260731173419_freelancer_workflow_features.sql`
- `20260801023428_track_billing_period.sql`
- `20260801030250_lock_down_function_execute_grants.sql`
- `20260801145756_local_benchmark.sql` (comments only; the version is already recorded)
- `20261019024229_proof_desk_watch.sql`
- `20261019030653_harden_proofs_access.sql`
- `20261019130555_recheck_saved_prospects.sql`
- `20261019130603_desk_notices_and_digest.sql`

Preview branches are still unsafe. No migration creates the `profiles` table.

## 3. Frontend environment

Set these for the Vite app. Names only:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GA_MEASUREMENT_ID` (optional; analytics stays off until a visitor accepts cookies)

## 4. Function secrets

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided by the platform. Set the rest with `supabase secrets set`. Do not print the values.

Required for the desk agent:

- `ANTHROPIC_API_KEY` — Ask your desk. If it is missing, the desk answers from saved records and does not call a model.
- `ALLOWED_ORIGINS` — comma-separated browser origins. A trailing slash is ignored. `https://zenvylo.app` and `https://www.zenvylo.app` are always allowed. Example: `https://www.zenvylo.app`

Optional for the scheduled jobs. There is not a second cron secret. If this is unset, the functions read Vault name `recheck_cron_secret` after migration `20261019142000` is applied. If it is set, that value wins.

- `RECHECK_CRON_SECRET`

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

## 5. Vault names the cron jobs already use

The scheduled jobs already send these Vault values. Do not create a second copy if the names exist.

- `recheck_cron_secret` — the header on both cron calls. After migration `20261019142000` is applied, the functions can read this same row when `RECHECK_CRON_SECRET` is unset.
- `project_url` — value shape `https://PROJECT.supabase.co`

## 6. Deploy functions

Redeploy these. They share the origin check, and `ai-proxy` plus `recheck-saved` are the ones Deno could not deploy from source. `daily-digest` picks up the Vault fallback.

```bash
supabase functions deploy audit-site
supabase functions deploy local-benchmark
supabase functions deploy ai-proxy
supabase functions deploy recheck-saved
supabase functions deploy daily-digest
supabase functions deploy audit-interest
supabase functions deploy admin-actions
```

`audit-site` measures websites. `recheck-saved` and a manual re-check both depend on that measurer.

`audit-interest`, `daily-digest`, and `recheck-saved` are called without a user JWT. `supabase/config.toml` sets `verify_jwt = false` for those three. Each one still checks its own credential: the proof hash, or the cron secret.

Stripe stays as it is. Do not change price IDs. Redeploy the webhook only if you are already deploying it with the others. `config.toml` turns the gateway JWT check off for it, because Stripe cannot send one. The function still rejects a body whose Stripe signature does not match.

```bash
supabase functions deploy stripe-checkout
supabase functions deploy stripe-webhook
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
- `npm run check` runs lint, tests, the production build, and `deno check` on every function entry point.
