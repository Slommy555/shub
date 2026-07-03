-- ============================================================================
-- 005_workout_sets_rest.sql — warm-up / failure set types + per-exercise rest
-- Run in the Supabase SQL Editor after 004. Safe to run once.
-- ============================================================================

-- Tag each logged set as a warm-up, normal working set, or a to-failure set.
alter table public.workout_sets
  add column if not exists set_type text not null default 'normal';

do $$
begin
  alter table public.workout_sets
    add constraint workout_sets_set_type_check
    check (set_type in ('warmup', 'normal', 'failure'));
exception
  when duplicate_object then null;
end $$;

-- Default rest between sets for a template's exercise (seconds).
alter table public.template_exercises
  add column if not exists rest_seconds integer;
