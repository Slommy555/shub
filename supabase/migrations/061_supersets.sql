-- ============================================================================
-- 061_supersets.sql — superset pairing + the drop-set type
-- Safe to run more than once (every statement is guarded).
--
-- A superset is two (or more) exercises done back to back, alternating a set of
-- each. Membership is a shared `superset_group_id`: the exercises carrying the
-- same uuid are paired. Null means "not in a superset", which is every row that
-- existed before this migration.
--
-- The id lives on BOTH sides so a pairing survives the round trip:
--   template_exercises — the plan ("these two are supersetted")
--   workout_sets       — what was actually logged, so History can group it back
-- ============================================================================

alter table public.template_exercises
  add column if not exists superset_group_id uuid;

alter table public.workout_sets
  add column if not exists superset_group_id uuid;

-- Look-ups are always "the rows in this group", scoped to a parent.
create index if not exists template_exercises_superset_idx
  on public.template_exercises (template_id, superset_group_id);
create index if not exists workout_sets_superset_idx
  on public.workout_sets (log_id, superset_group_id);

-- Widen the set-type check to allow drop sets alongside warm-up and failure.
-- (018 created this constraint with the original three values.)
alter table public.workout_sets
  drop constraint if exists workout_sets_set_type_check;

do $$
begin
  alter table public.workout_sets
    add constraint workout_sets_set_type_check
    check (set_type in ('warmup', 'normal', 'failure', 'dropset'));
exception
  when duplicate_object then null;
end $$;
