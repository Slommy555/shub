-- ============================================================================
-- 025_telegram_cron.sql — schedule the telegram-brief Edge Function every minute
--
-- Reuses the pg_cron + pg_net setup and GUCs (app.supabase_url,
-- app.supabase_anon_key) already established in 021_cron_push.sql. The Edge
-- Function itself decides, per user, whether it's their delivery time and
-- whether a brief was already sent today. unschedule() first so re-running this
-- migration never creates duplicate jobs.
--
-- ⚠ If pg_cron / pg_net are somehow not enabled, turn them on in the Supabase
--   dashboard → Database → Extensions before this runs.
-- ============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  perform cron.unschedule('telegram-brief-check');
exception when others then null;
end $$;

select cron.schedule(
  'telegram-brief-check',
  '* * * * *',
  $$
  select net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/telegram-brief',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    ),
    body := '{}'::jsonb
  )
  $$
);
