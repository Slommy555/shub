-- ============================================================================
-- 004_workout.sql — Workout Logger feature (self-contained)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- after 001–003, or via `supabase db push`.
--
-- NOTE ON NUMBERING: the spec called this "002_workout.sql", but 002 and 003
-- already exist in this project (categories, completion_date). It is numbered
-- 004 here so it applies cleanly on top of the existing schema.
--
-- All tables get Row Level Security: a user may only read/write their own rows.
-- The one nuance is `exercises`: the seeded default library has user_id = NULL
-- and is readable by everyone (a shared catalog), while custom exercises are
-- per-user. Writes are always restricted to the signed-in user's own rows.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- exercises — master exercise library (shared defaults + per-user custom)
-- ----------------------------------------------------------------------------
create table if not exists public.exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete cascade,
  name          text not null,
  muscle_groups text[] not null default '{}',
  is_custom     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists exercises_user_id_idx on public.exercises (user_id);

-- ----------------------------------------------------------------------------
-- workout_templates
-- ----------------------------------------------------------------------------
create table if not exists public.workout_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  notes      text,
  created_at timestamptz not null default now()
);

create index if not exists workout_templates_user_id_idx
  on public.workout_templates (user_id);

-- ----------------------------------------------------------------------------
-- template_exercises
-- ----------------------------------------------------------------------------
create table if not exists public.template_exercises (
  id             uuid primary key default gen_random_uuid(),
  template_id    uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id    uuid not null references public.exercises (id) on delete cascade,
  position       integer not null default 0,
  default_sets   integer,
  default_reps   integer,
  default_weight numeric
);

create index if not exists template_exercises_template_idx
  on public.template_exercises (template_id, position);

-- ----------------------------------------------------------------------------
-- workout_logs — one row per completed (or in-progress) session
-- ----------------------------------------------------------------------------
create table if not exists public.workout_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  template_id  uuid references public.workout_templates (id) on delete set null,
  name         text not null default 'Freestyle Workout',
  notes        text,
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists workout_logs_user_started_idx
  on public.workout_logs (user_id, started_at desc);

-- ----------------------------------------------------------------------------
-- workout_sets — one row per logged set
-- ----------------------------------------------------------------------------
create table if not exists public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  log_id       uuid not null references public.workout_logs (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  set_number   integer not null default 1,
  weight_lbs   numeric,
  reps         integer,
  rpe          integer check (rpe is null or (rpe between 1 and 10)),
  notes        text,
  completed_at timestamptz not null default now()
);

create index if not exists workout_sets_log_idx on public.workout_sets (log_id);
create index if not exists workout_sets_exercise_idx on public.workout_sets (exercise_id);

-- ----------------------------------------------------------------------------
-- body_weight_logs
-- ----------------------------------------------------------------------------
create table if not exists public.body_weight_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  weight_lbs numeric not null,
  logged_at  date not null default current_date,
  notes      text
);

create index if not exists body_weight_logs_user_date_idx
  on public.body_weight_logs (user_id, logged_at desc);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.exercises          enable row level security;
alter table public.workout_templates  enable row level security;
alter table public.template_exercises enable row level security;
alter table public.workout_logs       enable row level security;
alter table public.workout_sets       enable row level security;
alter table public.body_weight_logs   enable row level security;

-- exercises: shared default library (user_id null) is readable by all; custom
-- exercises are per-user. Writes only ever touch the user's own rows.
drop policy if exists "exercises_select" on public.exercises;
create policy "exercises_select" on public.exercises
  for select using (user_id is null or auth.uid() = user_id);

drop policy if exists "exercises_insert_own" on public.exercises;
create policy "exercises_insert_own" on public.exercises
  for insert with check (auth.uid() = user_id);

drop policy if exists "exercises_update_own" on public.exercises;
create policy "exercises_update_own" on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_delete_own" on public.exercises
  for delete using (auth.uid() = user_id);

-- workout_templates: own rows only.
drop policy if exists "templates_select_own" on public.workout_templates;
create policy "templates_select_own" on public.workout_templates
  for select using (auth.uid() = user_id);
drop policy if exists "templates_insert_own" on public.workout_templates;
create policy "templates_insert_own" on public.workout_templates
  for insert with check (auth.uid() = user_id);
drop policy if exists "templates_update_own" on public.workout_templates;
create policy "templates_update_own" on public.workout_templates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "templates_delete_own" on public.workout_templates;
create policy "templates_delete_own" on public.workout_templates
  for delete using (auth.uid() = user_id);

-- template_exercises: ownership derived from the parent template.
drop policy if exists "template_exercises_all_own" on public.template_exercises;
create policy "template_exercises_all_own" on public.template_exercises
  for all using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  );

-- workout_logs: own rows only.
drop policy if exists "logs_select_own" on public.workout_logs;
create policy "logs_select_own" on public.workout_logs
  for select using (auth.uid() = user_id);
drop policy if exists "logs_insert_own" on public.workout_logs;
create policy "logs_insert_own" on public.workout_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists "logs_update_own" on public.workout_logs;
create policy "logs_update_own" on public.workout_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "logs_delete_own" on public.workout_logs;
create policy "logs_delete_own" on public.workout_logs
  for delete using (auth.uid() = user_id);

-- workout_sets: ownership derived from the parent log.
drop policy if exists "sets_all_own" on public.workout_sets;
create policy "sets_all_own" on public.workout_sets
  for all using (
    exists (
      select 1 from public.workout_logs l
      where l.id = workout_sets.log_id and l.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.workout_logs l
      where l.id = workout_sets.log_id and l.user_id = auth.uid()
    )
  );

-- body_weight_logs: own rows only.
drop policy if exists "bw_select_own" on public.body_weight_logs;
create policy "bw_select_own" on public.body_weight_logs
  for select using (auth.uid() = user_id);
drop policy if exists "bw_insert_own" on public.body_weight_logs;
create policy "bw_insert_own" on public.body_weight_logs
  for insert with check (auth.uid() = user_id);
drop policy if exists "bw_update_own" on public.body_weight_logs;
create policy "bw_update_own" on public.body_weight_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "bw_delete_own" on public.body_weight_logs;
create policy "bw_delete_own" on public.body_weight_logs
  for delete using (auth.uid() = user_id);

-- ============================================================================
-- Seed: ~46 default exercises covering all 16 muscle groups.
-- Idempotent: only seeds when no default-library rows exist yet.
-- ============================================================================
insert into public.exercises (name, muscle_groups, is_custom)
select name, muscle_groups, false
from (
  values
    ('Barbell Bench Press',      array['mid_chest','front_delts','triceps_lateral']),
    ('Incline Dumbbell Press',   array['upper_chest','front_delts','triceps_lateral']),
    ('Dumbbell Bench Press',     array['mid_chest','front_delts','triceps_lateral']),
    ('Push-Up',                  array['mid_chest','front_delts','triceps_lateral']),
    ('Cable Fly',                array['mid_chest','lower_chest']),
    ('Dumbbell Pullover',        array['lats','lower_chest','serratus']),
    ('Pull-Up',                  array['lats','teres','biceps']),
    ('Lat Pulldown',             array['lats','teres','biceps']),
    ('Bent-Over Barbell Row',    array['lats','rhomboids','traps_mid','lower_back','biceps']),
    ('Seated Cable Row',         array['lats','rhomboids','traps_mid','biceps']),
    ('T-Bar Row',                array['lats','rhomboids','traps_mid']),
    ('Barbell Shrug',            array['traps_upper','traps_mid']),
    ('Deadlift',                 array['lower_back','glutes','hamstrings','traps_upper','forearm_flexors']),
    ('Face Pull',                array['rear_delts','traps_mid','rhomboids']),
    ('Y-Raise',                  array['traps_lower','traps_mid','rear_delts']),
    ('Overhead Barbell Press',   array['front_delts','side_delts','triceps_long']),
    ('Dumbbell Shoulder Press',  array['front_delts','side_delts','triceps_long']),
    ('Arnold Press',             array['front_delts','side_delts','triceps_long']),
    ('Dumbbell Lateral Raise',   array['side_delts']),
    ('Front Raise',              array['front_delts','upper_chest']),
    ('Rear Delt Fly',            array['rear_delts']),
    ('Barbell Curl',             array['biceps','brachialis','forearm_flexors']),
    ('Dumbbell Curl',            array['biceps','brachialis']),
    ('Hammer Curl',              array['brachialis','forearm_flexors','biceps']),
    ('Preacher Curl',            array['biceps','brachialis']),
    ('Concentration Curl',       array['biceps']),
    ('Tricep Pushdown',          array['triceps_lateral','triceps_medial']),
    ('Overhead Tricep Extension',array['triceps_long','triceps_medial']),
    ('Skull Crusher',            array['triceps_long','triceps_lateral']),
    ('Close-Grip Bench Press',   array['triceps_lateral','mid_chest','front_delts']),
    ('Dips',                     array['lower_chest','triceps_lateral','front_delts']),
    ('Wrist Curl',               array['forearm_flexors']),
    ('Reverse Wrist Curl',       array['forearm_extensors']),
    ('Farmer''s Carry',          array['forearm_flexors','traps_upper','glutes']),
    ('Barbell Back Squat',       array['quads_rectus','quads_lateral','quads_medial','glutes','lower_back']),
    ('Front Squat',              array['quads_rectus','quads_lateral','quads_medial','glutes']),
    ('Leg Press',                array['quads_lateral','quads_medial','glutes','hamstrings']),
    ('Romanian Deadlift',        array['hamstrings','glutes','lower_back']),
    ('Leg Extension',            array['quads_rectus','quads_lateral','quads_medial']),
    ('Leg Curl',                 array['hamstrings']),
    ('Walking Lunge',            array['quads_rectus','glutes','hamstrings','adductors']),
    ('Hip Thrust',               array['glutes','hamstrings']),
    ('Hip Adductor Machine',     array['adductors']),
    ('Standing Calf Raise',      array['calves_gastroc','calves_soleus']),
    ('Seated Calf Raise',        array['calves_soleus']),
    ('Tibialis Raise',           array['tibialis']),
    ('Plank',                    array['upper_abs','lower_abs','obliques']),
    ('Hanging Leg Raise',        array['lower_abs','obliques']),
    ('Cable Crunch',             array['upper_abs','lower_abs']),
    ('Russian Twist',            array['obliques','upper_abs']),
    ('Back Extension',           array['lower_back','glutes']),
    ('Hyperextension',           array['lower_back','glutes','hamstrings'])
) as seed(name, muscle_groups)
where not exists (
  select 1 from public.exercises where is_custom = false
);
