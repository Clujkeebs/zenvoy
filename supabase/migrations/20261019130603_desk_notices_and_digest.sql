-- APPLIED on the live database as version 20261019130603.
-- This file used to be named 20261019044856_desk_notices_and_digest.sql.
-- The rename matches schema_migrations so push does not run it again.
-- Do not edit the statements below.
--
-- Adds an opt-in flag for a daily note to the freelancer, an in-app notice
-- inbox, a place for proof-page replies, and saved searches. Nothing here
-- emails a business. The job emails profiles.email only, and only when that
-- account has digest_opt_in and the mail secret is set.
--
-- The drop-schema file is in supabase/archive and is not a migration.
-- This file does not drop a schema. It contains no secret.
--
-- Before the morning job can succeed:
--   1. supabase functions deploy daily-digest
--   2. The same RECHECK_CRON_SECRET already used by recheck-saved
--      (16+ characters). No second secret.
--   3. Vault names, same as the re-check job:
--        select vault.create_secret('<that secret>', 'recheck_cron_secret');
--        select vault.create_secret('https://PROJECT.supabase.co', 'project_url');
--   4. Optional mail. If these are unset, the job still writes an in-app
--      notice and does not send email:
--        supabase secrets set RESEND_API_KEY=...
--        supabase secrets set DIGEST_FROM='Zenvylo <notes@your-domain>'

alter table public.profiles
  add column if not exists digest_opt_in boolean not null default false;

grant update (digest_opt_in) on public.profiles to authenticated;

create table if not exists public.desk_notices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('watch', 'follow_up', 'interest', 'digest')),
  title text not null,
  body text not null default '',
  business_name text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.audit_interest (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  business_name text,
  from_name text,
  note text,
  proof_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  country text not null,
  city text,
  service_id text,
  service_custom text,
  lead_count integer,
  created_at timestamptz not null default now()
);

alter table public.desk_notices enable row level security;
alter table public.audit_interest enable row level security;
alter table public.saved_searches enable row level security;

drop policy if exists "read own notices" on public.desk_notices;
create policy "read own notices" on public.desk_notices
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "mark own notices read" on public.desk_notices;
create policy "mark own notices read" on public.desk_notices
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "read own audit interest" on public.audit_interest;
create policy "read own audit interest" on public.audit_interest
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own saved searches" on public.saved_searches;
create policy "own saved searches" on public.saved_searches
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.desk_notices from public, anon, authenticated;
grant select on table public.desk_notices to authenticated;
grant update (read_at) on table public.desk_notices to authenticated;

revoke all on table public.audit_interest from public, anon, authenticated;
grant select on table public.audit_interest to authenticated;

revoke all on table public.saved_searches from public, anon, authenticated;
grant select, insert, update, delete on table public.saved_searches to authenticated;

create index if not exists idx_desk_notices_user_created
  on public.desk_notices (user_id, created_at desc);
create index if not exists idx_audit_interest_user_created
  on public.audit_interest (user_id, created_at desc);
create index if not exists idx_audit_interest_code_created
  on public.audit_interest (proof_code, created_at desc);
create index if not exists idx_saved_searches_user
  on public.saved_searches (user_id, created_at desc);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $unschedule$
begin
  perform cron.unschedule('daily-desk-digest');
exception
  when others then
    null;
end
$unschedule$;

select cron.schedule(
  'daily-desk-digest',
  '30 7 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-recheck-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recheck_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
