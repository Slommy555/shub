-- ============================================================================
-- 056_workout_programs.sql — training programs (the Workout → Program tab).
--
-- A program is a repeating split run for a fixed number of weeks:
--   * workout_programs : the block itself — name, cycle length (7 or 8 days),
--                        total weeks, start date, and whether it's the active one.
--   * program_days     : the DEFAULT split — one row per cycle day (1..cycle_length),
--                        pointing at a workout template, or marked as a rest day.
--   * program_weeks    : per-week state — deload flag + volume %, a note, and
--                        `override_days`, a jsonb map of cycle day → day patch for
--                        weeks that deviate from the default split:
--                          { "3": { "template_id": "…", "label": "Pull B", "is_rest": false } }
--
-- An 8-day cycle is deliberately NOT tied to weekdays: a "week" is one pass of
-- the cycle, and today's cycle day = days_since_start % cycle_length + 1.
--
-- Ownership on the child tables is derived from the parent program (the same
-- pattern workout_sets uses for workout_logs), so there is no denormalised
-- user_id to keep in sync. Fully idempotent — safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- programs ---------------------------------------------------------------
create table if not exists public.workout_programs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null default 'Program',
  cycle_length integer not null default 7 check (cycle_length between 1 and 14),
  total_weeks  integer not null default 12 check (total_weeks between 1 and 104),
  start_date   date not null default current_date,
  is_active    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists workout_programs_user_idx on public.workout_programs (user_id, created_at desc);

alter table public.workout_programs enable row level security;
drop policy if exists "workout_programs_all_own" on public.workout_programs;
create policy "workout_programs_all_own" on public.workout_programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- default split (one row per cycle day) ----------------------------------
create table if not exists public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.workout_programs (id) on delete cascade,
  day_number  integer not null,
  template_id uuid references public.workout_templates (id) on delete set null,
  label       text,
  is_rest     boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (program_id, day_number)
);

create index if not exists program_days_program_idx on public.program_days (program_id, day_number);

alter table public.program_days enable row level security;
drop policy if exists "program_days_all_own" on public.program_days;
create policy "program_days_all_own" on public.program_days
  for all using (
    exists (
      select 1 from public.workout_programs p
      where p.id = program_days.program_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_programs p
      where p.id = program_days.program_id and p.user_id = auth.uid()
    )
  );

-- --- per-week state (deload, notes, day overrides) ---------------------------
create table if not exists public.program_weeks (
  id                uuid primary key default gen_random_uuid(),
  program_id        uuid not null references public.workout_programs (id) on delete cascade,
  week_number       integer not null,
  is_deload         boolean not null default false,
  deload_volume_pct numeric not null default 0.6,
  notes             text,
  override_days     jsonb,
  created_at        timestamptz not null default now(),
  unique (program_id, week_number)
);

create index if not exists program_weeks_program_idx on public.program_weeks (program_id, week_number);

alter table public.program_weeks enable row level security;
drop policy if exists "program_weeks_all_own" on public.program_weeks;
create policy "program_weeks_all_own" on public.program_weeks
  for all using (
    exists (
      select 1 from public.workout_programs p
      where p.id = program_weeks.program_id and p.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_programs p
      where p.id = program_weeks.program_id and p.user_id = auth.uid()
    )
  );

-- --- realtime ---------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.workout_programs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.program_days; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.program_weeks; exception when duplicate_object then null; end;
end $$;
