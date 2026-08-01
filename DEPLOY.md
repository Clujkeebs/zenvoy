# Deployment — what you have to do

**None of the security fixes in this branch are live until you complete steps 1–4.**
The code is correct; the database and the deployed functions are not yet.

Your Supabase project (`tyhhtbtxdwxjcziwmrpx`) is currently **paused**, so the
app is down anyway. Restore it first, from the Supabase dashboard.

---

## 1. Run the migration

Supabase Dashboard → SQL Editor → paste
`supabase/migrations/20260729000000_hardening.sql` → Run.

It is idempotent — safe to run twice, and safe on a database whose exact state
we couldn't inspect.

**Take a database backup first.** It changes permissions, and getting locked out
of your own tables is a bad afternoon.

Then run the four verification queries at the bottom of that file. All four must
behave as described before you move on.

## 2. Set the secrets

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...     # Stripe → Webhooks → your endpoint → Signing secret
supabase secrets set STRIPE_SECRET_KEY=sk_live_...       # if not already set
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # if not already set
supabase secrets set ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

`ALLOWED_ORIGINS` replaces `Access-Control-Allow-Origin: *`. If you leave it
unset the functions fall back to `*` so local dev still works — set it in
production.

## 3. Deploy the functions

```bash
supabase functions deploy ai-proxy
supabase functions deploy audit-site
supabase functions deploy admin-actions
supabase functions deploy stripe-webhook --no-verify-jwt
```

`--no-verify-jwt` on the webhook only: Stripe can't present a Supabase JWT, and
the signature check is what authenticates it now.

## 4. Rotate your Anthropic key

The old `ai-proxy` was an unauthenticated open proxy. Anyone who found the URL
could spend your Anthropic credit, and you have no way to know whether anyone
did. Treat the key as burned: issue a new one, set it as the secret, revoke the
old one.

While you're there, check the usage graph in the Anthropic console for spikes
that don't match your traffic.

## 5. Verify the webhook end to end

Stripe Dashboard → Webhooks → your endpoint → **Send test webhook** →
`customer.subscription.updated`. It should return 200.

Then confirm the hole is actually closed:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/stripe-webhook \
  -H 'Content-Type: application/json' \
  -d '{"type":"customer.subscription.updated","data":{"object":{"metadata":{"supabase_uid":"any","plan":"scale"},"status":"active"}}}'
```

Expected: `400 {"error":"Invalid signature"}`. Before this branch, that request
granted a free Scale subscription.

## 6. Storage bucket

If `avatars` doesn't exist: Storage → New Bucket → name `avatars`, Public ON.
The migration adds the policies that scope writes to each user's own folder;
without the bucket, that block is skipped silently.

---

## Environment variables (Vercel)

| Variable | Where | Notes |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel | Public |
| `VITE_SUPABASE_ANON_KEY` | Vercel | Public by design — it ships in the bundle |

Never put a secret behind a `VITE_` prefix. Vite inlines those into the client
bundle at build time.

## URL routing

Pages now have real URLs (`/leads`, `/settings`, …). This is a single-page app,
so the host has to serve `index.html` for any unmatched path or a refresh on
`/leads` will 404.

Vercel handles this automatically for Vite projects. If you ever move hosts, add
the equivalent SPA fallback rewrite.

---

## Local development

```bash
npm install
npm run dev

npm run check   # lint + tests + build, same as CI
```
