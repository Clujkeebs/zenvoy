# Zenvoy 3.2 — Supabase Migration

## What Changed

`db.js` was completely rewritten from localStorage to Supabase.
Every function is now async. The 11 files that call DB functions
were updated to handle Promises correctly.

**Pattern used:**
- **Reads** → `await DB.getLeads()` in `useEffect` or `async` callbacks
- **Writes** → fire-and-forget: `DB.saveUser(email, u)` runs in background
  while React state already has the correct data
- **Auth** → `DB.signUp()` / `DB.signIn()` replace localStorage password checks

## What You Need to Do

### 1. Create Supabase Project (5 min)
- Go to [supabase.com](https://supabase.com) → New Project
- Wait 2 min for it to provision

### 2. Run the Schema (2 min)
- Go to SQL Editor → paste `supabase-schema-v2.sql` → Run
- This creates all 9 tables, indexes, RLS policies, and seeds community groups

### 3. Create Avatars Bucket (1 min)
- Dashboard → Storage → New Bucket
- Name: `avatars` → Public: ON

### 4. Copy Your Keys (1 min)
- Settings → API → copy `Project URL` and `anon public` key
- Create `.env.local`:
```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### 5. Install and Run
```bash
npm install
npm run dev
```

### 6. Disable Email Confirmation (optional, for testing)
- Auth → Settings → toggle OFF "Enable email confirmations"
- This lets you sign up and immediately use the app

## Table Reference

| Table | Purpose |
|---|---|
| `profiles` | User accounts (extends Supabase auth) |
| `leads` | AI-generated business leads |
| `clients` | Converted clients CRM |
| `scans` | Scan history log |
| `global_lead_names` | Lead dedup registry |
| `groups` | Community groups |
| `user_groups` | Group membership (join/leave) |
| `posts` | Community posts + group posts |
| `reports` | Flagged content/users |

## Auth Flow

Old: `localStorage.setItem("pass", plaintext)` → compare on login
New: `supabase.auth.signUp()` → bcrypt hashing → JWT session → RLS

The signup trigger automatically creates a `profiles` row with the
user's metadata (name, country, etc.) and assigns `admin@zenvoy.com`
the admin role.

## What Still Uses localStorage

Only `scanQuota.js` — it tracks the 3 free scans/month for users
on the Free plan. This is intentional since it's a client-side rate
limit, not security-critical data. When you add server-side billing
(Stripe), scan limits will be enforced by the API routes instead.
