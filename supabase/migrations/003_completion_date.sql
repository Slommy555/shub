-- ============================================================================
-- 003_completion_date.sql — Separate "completion date" (plan/work day) from
-- the hard "due_date" (actual Canvas deadline).
-- Run this in the Supabase SQL Editor. Safe to run once.
-- ============================================================================

-- The day the user plans to work on / list the task under. NULL means "fall
-- back to due_date" (so existing rows keep listing exactly as before).
alter table public.tasks
  add column if not exists scheduled_date date;

create index if not exists tasks_user_id_scheduled_idx
  on public.tasks (user_id, scheduled_date);
