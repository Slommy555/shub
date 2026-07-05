-- ============================================================================
-- 023_work_schedule_sync.sql — sync the recurring work schedule across devices
-- Run via `supabase db push` or the Supabase SQL Editor (after 012/014/017).
--
-- The work schedule (which weekdays the user works, each day's shift times, and
-- sleep hours) lived only in localStorage, so a shift configured on desktop
-- never appeared in the timeline on a phone signed into the same account. This
-- adds a nullable `work_schedule` jsonb to user_preferences so it follows the
-- user across devices via the same realtime subscription as theme/custom_colors.
-- Shape: { "workDays": number[], "shifts": { "<dow>": {start,end,notes,color} },
--          "sleepHours": number }. RLS + realtime publication were set up in 012.
-- ============================================================================

alter table public.user_preferences
  add column if not exists work_schedule jsonb;
