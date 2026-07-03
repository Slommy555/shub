-- ============================================================================
-- 017_user_preferences_show_rpe.sql — add the "Display RPE" workout preference
-- Run via `supabase db push` or the Supabase SQL Editor (after 012/014).
--
-- Adds a `show_rpe` boolean to user_preferences (default false) so the workout
-- logger's RPE column is hidden unless the user opts in. Syncs across devices
-- via the same realtime subscription as `theme` / `custom_colors`. RLS + the
-- realtime publication membership were already set up in 012.
-- ============================================================================

alter table public.user_preferences
  add column if not exists show_rpe boolean not null default false;
