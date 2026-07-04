-- ============================================================================
-- 020_notifications.sql — push-notification settings + log
-- Adds FCM token + daily-brief/reminder preferences to user_preferences, a
-- per-habit reminder_time, notes.include_in_brief, and a notification_log table.
-- Idempotent (safe to re-run). Requires user_preferences (012) and habits (009).
-- ============================================================================

-- --- user_preferences: push + brief settings ------------------------------
alter table public.user_preferences
  add column if not exists fcm_token             text,
  add column if not exists notification_enabled  boolean not null default false,
  add column if not exists notification_time     time    not null default '07:00',
  add column if not exists notification_timezone text    not null default 'America/Los_Angeles',
  add column if not exists notification_sections jsonb   not null default
    '{"schedule":true,"tasks":true,"habits":true,"workout":true,"budget":true,"notes":true}'::jsonb,
  add column if not exists task_reminders_enabled boolean not null default true,
  add column if not exists workout_schedule       jsonb;

-- --- per-habit reminder time ----------------------------------------------
alter table public.habits
  add column if not exists reminder_time time;

-- --- notes flagged for the daily brief ------------------------------------
alter table public.notes
  add column if not exists include_in_brief boolean not null default false;

-- --- notification_log ------------------------------------------------------
create table if not exists public.notification_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  sent_at       timestamptz not null default now(),
  type          text not null default 'daily_brief'
                  check (type in ('daily_brief', 'task_reminder', 'habit_reminder', 'test')),
  status        text not null default 'success' check (status in ('success', 'failed')),
  error_message text,
  content       text
);
create index if not exists notification_log_user_sent_idx
  on public.notification_log (user_id, sent_at desc);

alter table public.notification_log enable row level security;
drop policy if exists "notification_log_select_own" on public.notification_log;
create policy "notification_log_select_own" on public.notification_log
  for select using (auth.uid() = user_id);
-- Inserts happen from Edge Functions using the service role (bypasses RLS).

-- notification_log drives the in-app "recent briefs" bell, so keep it live.
do $$
begin
  begin alter publication supabase_realtime add table public.notification_log; exception when duplicate_object then null; end;
end $$;
