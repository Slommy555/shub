-- ============================================================================
-- 057_home_layout.sql — remembered Home tab widget order.
--
-- A jsonb array of card ids in the order the user arranged them, e.g.
--   ["budget", "tasks", "program", "habits", "weight", "events"]
--
-- Unknown ids are ignored and missing ones are appended on read, so adding a new
-- Home card later never strands a saved layout. null / absent = the default order.
--
-- Lives on user_preferences alongside the other cross-device prefs (theme,
-- accent, show_rpe) so a layout set on the desktop follows you to the phone.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.user_preferences
  add column if not exists home_layout jsonb;
