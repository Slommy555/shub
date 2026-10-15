-- Lift: standalone workout logger (lift/ app).
-- All tables are prefixed lift_ so they stay isolated from the existing app's
-- exercises / workout_* / program_* tables in this same project.
-- Written idempotently so re-running is safe.

create table if not exists public.lift_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  muscle_group text,  -- chest, back, shoulders, biceps, triceps, legs, core, other
  equipment text,     -- barbell, dumbbell, cable, machine, bodyweight, other
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.lift_workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  day_label text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.lift_template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.lift_workout_templates(id) on delete cascade,
  exercise_id uuid not null references public.lift_exercises(id) on delete cascade,
  position integer not null,
  default_sets integer not null default 3,
  default_reps integer not null default 10,
  default_weight numeric,
  superset_group_id uuid,
  rest_seconds integer not null default 90,
  notes text
);

create table if not exists public.lift_workout_programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  cycle_length integer not null default 7,
  total_weeks integer not null default 12,
  start_date date,
  is_active boolean not null default false,
  deload_weeks integer[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Several rows may share a day_number (multiple workouts on one day).
create table if not exists public.lift_program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.lift_workout_programs(id) on delete cascade,
  day_number integer not null,
  template_id uuid references public.lift_workout_templates(id) on delete set null,
  label text,
  is_rest boolean not null default false,
  position integer not null default 0
);

create table if not exists public.lift_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  template_id uuid references public.lift_workout_templates(id) on delete set null,
  program_day_id uuid references public.lift_program_days(id) on delete set null,
  name text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text,
  duration_seconds integer
);

create table if not exists public.lift_workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lift_workout_sessions(id) on delete cascade,
  exercise_id uuid not null references public.lift_exercises(id) on delete cascade,
  set_number integer not null,
  weight numeric,
  reps integer,
  is_warmup boolean not null default false,
  is_failure boolean not null default false,
  is_dropset boolean not null default false,
  drop_weight numeric,
  drop_reps integer,
  superset_group_id uuid,
  logged_at timestamptz not null default now()
);

create index if not exists lift_exercises_user_idx on public.lift_exercises(user_id);
create index if not exists lift_templates_user_idx on public.lift_workout_templates(user_id);
create index if not exists lift_template_exercises_template_idx on public.lift_template_exercises(template_id);
create index if not exists lift_programs_user_idx on public.lift_workout_programs(user_id);
create index if not exists lift_program_days_program_idx on public.lift_program_days(program_id);
create index if not exists lift_sessions_user_idx on public.lift_workout_sessions(user_id, started_at desc);
create index if not exists lift_sets_session_idx on public.lift_workout_sets(session_id);
create index if not exists lift_sets_exercise_idx on public.lift_workout_sets(exercise_id);

alter table public.lift_exercises enable row level security;
alter table public.lift_workout_templates enable row level security;
alter table public.lift_template_exercises enable row level security;
alter table public.lift_workout_programs enable row level security;
alter table public.lift_program_days enable row level security;
alter table public.lift_workout_sessions enable row level security;
alter table public.lift_workout_sets enable row level security;

-- Exercises: everyone signed in can read defaults; users own their custom rows.
drop policy if exists "lift read" on public.lift_exercises;
create policy "lift read" on public.lift_exercises for select
  using (is_default or auth.uid() = user_id);
drop policy if exists "lift own" on public.lift_exercises;
create policy "lift own" on public.lift_exercises for all
  using (auth.uid() = user_id and not is_default)
  with check (auth.uid() = user_id and not is_default);

drop policy if exists "lift own" on public.lift_workout_templates;
create policy "lift own" on public.lift_workout_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lift own" on public.lift_workout_programs;
create policy "lift own" on public.lift_workout_programs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lift own" on public.lift_workout_sessions;
create policy "lift own" on public.lift_workout_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lift own" on public.lift_template_exercises;
create policy "lift own" on public.lift_template_exercises for all
  using (template_id in (select id from public.lift_workout_templates where user_id = auth.uid()))
  with check (template_id in (select id from public.lift_workout_templates where user_id = auth.uid()));

drop policy if exists "lift own" on public.lift_program_days;
create policy "lift own" on public.lift_program_days for all
  using (program_id in (select id from public.lift_workout_programs where user_id = auth.uid()))
  with check (program_id in (select id from public.lift_workout_programs where user_id = auth.uid()));

drop policy if exists "lift own" on public.lift_workout_sets;
create policy "lift own" on public.lift_workout_sets for all
  using (session_id in (select id from public.lift_workout_sessions where user_id = auth.uid()))
  with check (session_id in (select id from public.lift_workout_sessions where user_id = auth.uid()));

-- Default exercise library (skips any name already seeded).
insert into public.lift_exercises (name, muscle_group, equipment, is_default, user_id)
select v.name, v.muscle_group, v.equipment, true, null
from (values
  ('Back Squat','legs','barbell'),
  ('Front Squat','legs','barbell'),
  ('Romanian Deadlift','legs','barbell'),
  ('Deadlift','back','barbell'),
  ('Bench Press','chest','barbell'),
  ('Incline DB Press','chest','dumbbell'),
  ('Overhead Press','shoulders','barbell'),
  ('Barbell Row','back','barbell'),
  ('Pull-Up','back','bodyweight'),
  ('Lat Pulldown','back','cable'),
  ('Chest-Supported Row','back','machine'),
  ('Single-Arm DB Row','back','dumbbell'),
  ('Seated Cable Row','back','cable'),
  ('Face Pull','shoulders','cable'),
  ('Lateral Raise','shoulders','dumbbell'),
  ('Rear Delt Fly','shoulders','dumbbell'),
  ('Pec Deck','chest','machine'),
  ('Cable Fly','chest','cable'),
  ('Leg Press','legs','machine'),
  ('Walking Lunge','legs','dumbbell'),
  ('Leg Curl','legs','machine'),
  ('Leg Extension','legs','machine'),
  ('Standing Calf Raise','legs','machine'),
  ('Hip Thrust','legs','barbell'),
  ('EZ-Bar Curl','biceps','barbell'),
  ('Barbell Curl','biceps','barbell'),
  ('Incline DB Curl','biceps','dumbbell'),
  ('Hammer Curl','biceps','dumbbell'),
  ('Preacher Curl','biceps','machine'),
  ('Cable Curl','biceps','cable'),
  ('Reverse Curl','biceps','barbell'),
  ('Skull Crushers','triceps','barbell'),
  ('Rope Pushdown','triceps','cable'),
  ('Cable Overhead Triceps Ext','triceps','cable'),
  ('Diamond Push-Up','triceps','bodyweight'),
  ('Straight-Arm Pulldown','back','cable'),
  ('Seated DB Shoulder Press','shoulders','dumbbell')
) as v(name, muscle_group, equipment)
where not exists (
  select 1 from public.lift_exercises e where e.is_default and e.name = v.name
);
