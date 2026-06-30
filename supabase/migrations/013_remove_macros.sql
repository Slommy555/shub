-- ============================================================================
-- 013_remove_macros.sql — Remove the Macro Tracker feature
--
-- ⚠️  DESTRUCTIVE: running this PERMANENTLY DELETES all logged macro/food data
-- (food log entries, meal categories, macro targets, and saved foods). Back up
-- anything you want to keep before applying. Apply with `supabase db push` (or
-- paste into the Supabase SQL Editor) only when you're ready.
--
-- CASCADE drops dependent objects (RLS policies, indexes, the realtime
-- publication membership) that were created alongside these tables in
-- 011_macros.sql.
-- ============================================================================

drop table if exists public.food_log_entries cascade;
drop table if exists public.meal_categories cascade;
drop table if exists public.macro_targets cascade;
drop table if exists public.saved_foods cascade;
