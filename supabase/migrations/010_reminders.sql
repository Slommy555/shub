-- ============================================================================
-- 010_reminders.sql — Standalone timed reminders (the Reminders tab)
-- Run this in the Supabase SQL Editor after 001–009, or via `supabase db push`.
--
-- A reminder fires an OS notification at `remind_at`. One-offs are marked
-- `fired` once delivered; repeating reminders have their `remind_at` advanced
-- to the next occurrence instead. Delivery happens on the client (any device
-- running the app); see src/hooks/useScheduledReminders.ts.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  body       text,
  remind_at  timestamptz not null,
  repeat     text not null default 'none' check (repeat in ('none', 'daily', 'weekly')),
  fired      boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists reminders_user_id_remind_at_idx
  on public.reminders (user_id, remind_at);

alter table public.reminders enable row level security;

drop policy if exists "reminders_select_own" on public.reminders;
create policy "reminders_select_own" on public.reminders
  for select using (auth.uid() = user_id);

drop policy if exists "reminders_insert_own" on public.reminders;
create policy "reminders_insert_own" on public.reminders
  for insert with check (auth.uid() = user_id);

drop policy if exists "reminders_update_own" on public.reminders;
create policy "reminders_update_own" on public.reminders
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "reminders_delete_own" on public.reminders;
create policy "reminders_delete_own" on public.reminders
  for delete using (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.reminders;
  exception when duplicate_object then null;
  end;
end $$;
