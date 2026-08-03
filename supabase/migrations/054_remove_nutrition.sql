-- ============================================================================
-- 054_remove_nutrition.sql — drop the Nutrition tab's tables.
--
-- ⚠️  DESTRUCTIVE AND IRREVERSIBLE. This permanently deletes every logged
--     nutrition entry (nutrition_logs) and the daily macro goals
--     (nutrition_goals). There is no soft delete and no backup taken here.
--
-- Kept as a separate migration from 053 so the safe budget changes could be
-- applied without waiting on this one.
-- ============================================================================

drop table if exists public.nutrition_logs;
drop table if exists public.nutrition_goals;
