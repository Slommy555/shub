-- ============================================================================
-- 021_cron_push.sql — schedule the push Edge Functions via pg_cron + pg_net
--
-- ⚠ pg_cron and pg_net must be ENABLED first in the Supabase dashboard:
--   Database → Extensions → enable `pg_cron` and `pg_net`.
-- This migration also needs two GUCs to build the function URL + auth header:
--   app.supabase_url        e.g. https://<ref>.supabase.co
--   app.supabase_anon_key   the project anon key
-- Set them once (Supabase SQL editor, superuser) if they aren't already:
--   alter database postgres set app.supabase_url = 'https://<ref>.supabase.co';
--   alter database postgres set app.supabase_anon_key = '<anon-key>';
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Each job runs every minute; the Edge Function itself decides whether it's the
-- right time / whether anything needs sending. unschedule() first so re-running
-- this migration doesn't create duplicates.

do $$
begin
  perform cron.unschedule('daily-brief-push');
exception when others then null;
end $$;

select cron.schedule(
  'daily-brief-push',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/daily-brief-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

do $$
begin
  perform cron.unschedule('task-reminders');
exception when others then null;
end $$;

select cron.schedule(
  'task-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/task-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  )
  $$
);

do $$
begin
  perform cron.unschedule('habit-reminders');
exception when others then null;
end $$;

select cron.schedule(
  'habit-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/habit-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
