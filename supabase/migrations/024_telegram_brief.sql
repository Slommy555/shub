-- ============================================================================
-- 024_telegram_brief.sql — Telegram daily brief settings + delivery log
-- Run via `supabase db push` or the Supabase SQL Editor (after 020).
--
-- Adds Telegram-brief preferences to user_preferences and a telegram_brief_log
-- table recording each send. The workout_schedule column (user_preferences) and
-- notes.include_in_brief already exist from migration 020 and are reused as-is,
-- so they are intentionally NOT re-added here. RLS on the log lets a user read
-- only their own rows; the Edge Function writes with the service role (which
-- bypasses RLS).
-- ============================================================================

-- Telegram delivery preferences (mirrors the existing notification_* columns).
alter table public.user_preferences
  add column if not exists telegram_enabled  boolean not null default false,
  add column if not exists telegram_time     time    not null default '07:00',
  add column if not exists telegram_timezone text    not null default 'America/Los_Angeles',
  add column if not exists telegram_sections jsonb   not null default
    '{"schedule":true,"tasks":true,"habits":true,"workout":true,"budget":true,"notes":true,"recommendations":true}'::jsonb;

-- One row per send attempt (success or failure), for the "already sent today"
-- check and for reference / debugging.
create table if not exists public.telegram_brief_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  sent_at       timestamptz not null default now(),
  status        text not null,             -- 'success' | 'failed'
  error_message text,
  char_count    integer,
  content       text
);

create index if not exists telegram_brief_log_user_sent_idx
  on public.telegram_brief_log (user_id, sent_at desc);

alter table public.telegram_brief_log enable row level security;

-- Users can read only their own log rows. Writes happen via the service role in
-- the Edge Function, which bypasses RLS, so no insert policy is needed.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'telegram_brief_log'
      and policyname = 'telegram_brief_log_select_own'
  ) then
    create policy telegram_brief_log_select_own
      on public.telegram_brief_log
      for select
      using (auth.uid() = user_id);
  end if;
end $$;
