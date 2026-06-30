-- ============================================================================
-- 009_habits.sql — Habits & Goals (the Focus tab)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- after 001–008, or via `supabase db push`.
--
-- A "habit" is anything the user wants to do daily (a recurring habit or a
-- standing goal). Each day it's done, a row lands in habit_logs. Consistency
-- stats (streaks, completion rate) are derived client-side from those rows.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- habits — one row per habit/goal the user is tracking
-- ----------------------------------------------------------------------------
create table if not exists public.habits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  kind       text not null default 'habit' check (kind in ('habit', 'goal')),
  color      text not null default 'green',
  position   integer not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- habit_logs — one row per (habit, day) the habit was completed
-- ----------------------------------------------------------------------------
create table if not exists public.habit_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  habit_id  uuid not null references public.habits (id) on delete cascade,
  date      date not null,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists habits_user_id_position_idx
  on public.habits (user_id, position);
create index if not exists habit_logs_habit_id_date_idx
  on public.habit_logs (habit_id, date);
create index if not exists habit_logs_user_id_date_idx
  on public.habit_logs (user_id, date);

-- ----------------------------------------------------------------------------
-- Row Level Security — a user may only touch their own rows.
-- ----------------------------------------------------------------------------
alter table public.habits     enable row level security;
alter table public.habit_logs enable row level security;

drop policy if exists "habits_select_own" on public.habits;
create policy "habits_select_own" on public.habits
  for select using (auth.uid() = user_id);

drop policy if exists "habits_insert_own" on public.habits;
create policy "habits_insert_own" on public.habits
  for insert with check (auth.uid() = user_id);

drop policy if exists "habits_update_own" on public.habits;
create policy "habits_update_own" on public.habits
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "habits_delete_own" on public.habits;
create policy "habits_delete_own" on public.habits
  for delete using (auth.uid() = user_id);

drop policy if exists "habit_logs_select_own" on public.habit_logs;
create policy "habit_logs_select_own" on public.habit_logs
  for select using (auth.uid() = user_id);

drop policy if exists "habit_logs_insert_own" on public.habit_logs;
create policy "habit_logs_insert_own" on public.habit_logs
  for insert with check (auth.uid() = user_id);

drop policy if exists "habit_logs_delete_own" on public.habit_logs;
create policy "habit_logs_delete_own" on public.habit_logs
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Realtime — let the client subscribe to row changes on both tables.
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.habits;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.habit_logs;
  exception when duplicate_object then null;
  end;
end $$;
