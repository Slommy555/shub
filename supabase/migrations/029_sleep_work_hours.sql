-- ============================================================================
-- 029_sleep_work_hours.sql — persist sleep + work hours for schedule optimization
--
-- Adds flat, single-value sleep/work fields to user_preferences so the iOS
-- Settings screen can store them and Claude can later use them for schedule
-- optimization + the daily Telegram brief. These are intentionally simple
-- columns (separate from the richer `work_schedule` jsonb added in 023).
-- Idempotent: every add is guarded so re-running is safe.
-- ============================================================================

alter table public.user_preferences
  add column if not exists sleep_bedtime time default '22:00',
  add column if not exists sleep_waketime time default '07:00',
  add column if not exists work_start time default '09:00',
  add column if not exists work_end time default '17:00',
  add column if not exists work_days text[] default '{mon,tue,wed,thu,fri}';
