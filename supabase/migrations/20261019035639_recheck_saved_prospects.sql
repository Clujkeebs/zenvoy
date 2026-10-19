-- NOT APPLIED. Do not run this until you want the daily re-check job.
--
-- Daily re-check of saved prospect websites. The job calls the recheck-saved
-- edge function. Results land in leads.watch_log, which the Today desk and
-- the weekly digest already read. A row is written only when the new
-- measurement differs from the stored one. This does not spend a scan credit
-- and it does not send email.
--
-- `supabase db push` applies this file, because its version is not recorded.
-- It does not apply the old drop-schema file. That file is in
-- supabase/archive and is not a migration. The job still fails each morning
-- until the function is deployed and the Vault secrets exist.
--
-- This file contains no secret. Before the job can succeed:
--   1. supabase functions deploy recheck-saved
--   2. supabase secrets set RECHECK_CRON_SECRET=<long random, 16+ characters>
--   3. select vault.create_secret('<the same random value>', 'recheck_cron_secret');
--   4. select vault.create_secret('https://PROJECT.supabase.co', 'project_url');
--
-- Schedule shape follows the current Supabase docs for pg_cron + pg_net +
-- Vault (https://supabase.com/docs/guides/functions/schedule-functions).
-- pg_net's default timeout is 2 seconds, which is too short for a batch of
-- site fetches, so this job sets timeout_milliseconds to 150000.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $unschedule$
begin
  perform cron.unschedule('recheck-saved-prospects');
exception
  when others then
    null;
end
$unschedule$;

select cron.schedule(
  'recheck-saved-prospects',
  '15 6 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
            || '/functions/v1/recheck-saved',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-recheck-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'recheck_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
