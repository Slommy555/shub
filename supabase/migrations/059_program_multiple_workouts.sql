-- ============================================================================
-- 059_program_multiple_workouts.sql — more than one workout on a program day.
--
-- `program_days` carried a single `template_id`. A day can now hold an ORDERED
-- list of templates (do them in the order shown), so `template_ids uuid[]` is
-- the new source of truth.
--
-- `template_id` is kept and still written with the FIRST entry of the list:
--   * nothing that still reads the old column breaks mid-deploy, and
--   * a rollback degrades to "the first workout of the day" rather than to null.
--
-- Week overrides live in `program_weeks.override_days` (jsonb) and need no DDL —
-- a patch simply gains an optional "template_ids": [...] key alongside the
-- existing "template_id". Readers fall back to the singular key, so overrides
-- written before this migration keep resolving.
--
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.program_days
  add column if not exists template_ids uuid[] not null default '{}';

-- Backfill: an existing single template becomes a one-entry list. Only touches
-- rows that haven't been given a list yet, so re-running can't clobber edits.
update public.program_days
   set template_ids = array[template_id]
 where template_id is not null
   and cardinality(template_ids) = 0;
