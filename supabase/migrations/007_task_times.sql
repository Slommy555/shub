-- ============================================================================
-- 007_task_times.sql — Optional start/end time for a task, so timed things
-- (work shifts, events like hikes) can render as time-range blocks in the
-- Schedule view. Both nullable, so existing untimed tasks are unaffected.
-- Run this in the Supabase SQL Editor. Safe to run once.
-- ============================================================================

alter table public.tasks
  add column if not exists start_time time,
  add column if not exists end_time   time;
