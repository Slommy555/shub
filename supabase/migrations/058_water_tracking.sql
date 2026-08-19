-- ============================================================================
-- 058_water_tracking.sql — water intake as a special habit type
--
-- A "water habit" is an ordinary row in `habits` flagged with
-- `is_water_habit = true` and carrying a daily target in `water_goal_oz`.
-- Throughout the day the user logs cups/bottles into `water_logs`; when the
-- day's oz reach the goal the client writes the usual `habit_logs` row, so a
-- water habit's streaks and completion rate come out of exactly the same math
-- as every other habit. Logs are keyed by calendar day, so each new day
-- starts back at 0 oz with no reset step.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- habits — the water flag + the daily target
-- ----------------------------------------------------------------------------
alter table public.habits
  add column if not exists is_water_habit boolean not null default false;

alter table public.habits
  add column if not exists water_goal_oz numeric;

-- Only one water habit per user (archived ones don't count — the app hides
-- them, so they shouldn't block creating a new one).
create unique index if not exists habits_one_water_per_user_idx
  on public.habits (user_id)
  where is_water_habit and not archived;

-- ----------------------------------------------------------------------------
-- water_logs — one row per cup/bottle/glass logged
-- ----------------------------------------------------------------------------
create table if not exists public.water_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  habit_id   uuid not null references public.habits (id) on delete cascade,
  logged_at  date not null default current_date,
  oz         numeric not null,
  label      text,
  created_at timestamptz not null default now()
);

create index if not exists water_logs_habit_id_logged_at_idx
  on public.water_logs (habit_id, logged_at);
create index if not exists water_logs_user_id_logged_at_idx
  on public.water_logs (user_id, logged_at);

-- ----------------------------------------------------------------------------
-- Row Level Security — a user may only touch their own rows.
-- ----------------------------------------------------------------------------
alter table public.water_logs enable row level security;

drop policy if exists "water_logs_own" on public.water_logs;
create policy "water_logs_own" on public.water_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Realtime — the Home and Focus water cards both subscribe, so a tap in one
-- moves the other's progress bar.
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.water_logs;
  exception when duplicate_object then null;
  end;
end $$;
