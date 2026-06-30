-- ============================================================================
-- 008_task_recurrence.sql — Optional repeat rule for a task/event, so things
-- like classes, work-adjacent routines, or weekly events show on every matching
-- day. NULL means a one-off task (existing rows unaffected).
-- Run this in the Supabase SQL Editor. Safe to run once.
-- ============================================================================

alter table public.tasks
  add column if not exists recurrence text
    check (recurrence in ('daily', 'weekdays', 'weekly', 'monthly'));
