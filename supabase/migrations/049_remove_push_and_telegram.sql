-- ============================================================================
-- 049_remove_push_and_telegram.sql — tear down push notifications + Telegram
--
-- The app no longer sends notifications of any kind: the web-push stack (daily
-- brief, task reminders, habit reminders) and the Telegram daily brief were both
-- removed from the client and their Edge Functions deleted. This migration stops
-- the server side: it unschedules the pg_cron jobs that were calling those
-- functions every minute, and drops the preference columns/tables that only
-- existed to configure them.
--
-- Deliberately kept: `notification_log`, which holds the text of briefs that
-- were already generated. It is no longer read or written, but dropping it would
-- destroy content rather than configuration.
--
-- Idempotent: every step is guarded, so re-running is safe.
-- ============================================================================

-- 1. Unschedule the cron jobs (021_cron_push.sql, 025_telegram_cron.sql).
--    Wrapped individually so a missing job — or a database without pg_cron
--    installed at all — never fails the migration.
do $$
declare
  job text;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    foreach job in array array[
      'daily-brief-push',
      'task-reminders',
      'habit-reminders',
      'telegram-brief-check'
    ] loop
      begin
        perform cron.unschedule(job);
      exception when others then
        null; -- job wasn't scheduled
      end;
    end loop;
  end if;
end $$;

-- 2. Drop the Telegram integration entirely.
drop table if exists public.telegram_brief_log;

alter table public.user_preferences
  drop column if exists telegram_enabled,
  drop column if exists telegram_time,
  drop column if exists telegram_timezone,
  drop column if exists telegram_sections,
  drop column if exists telegram_chat_id;

-- 3. Drop the push/notification preference columns (configuration only).
alter table public.user_preferences
  drop column if exists notification_enabled,
  drop column if exists notification_time,
  drop column if exists notification_timezone,
  drop column if exists notification_sections,
  drop column if exists task_reminders_enabled,
  drop column if exists push_subscription;
