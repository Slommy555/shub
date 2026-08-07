-- ============================================================================
-- 055_drop_workout_schedule.sql — retire the weekly workout schedule.
--
-- The "Weekly Workout Schedule" settings panel (one template per weekday, stored
-- as a jsonb map on user_preferences) is replaced by the Program tab, which
-- models a real training block: a repeating 7- or 8-day split, a week count, and
-- per-week deload overrides (see 056_workout_programs.sql).
--
-- The only readers of this column were the push/Telegram daily briefs, both of
-- which were torn down in 049_remove_push_and_telegram.sql — nothing reads it.
-- Idempotent: guarded drop, safe to re-run.
-- ============================================================================

alter table public.user_preferences
  drop column if exists workout_schedule;
