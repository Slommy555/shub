# Session Progress

## Remove "Describe Your Meal" Feature — complete
- [x] Frontend removed — `MealDescriber.tsx` deleted (input, Analyze Meal button, OR divider, breakdown card, source badges, loading + error states); `NutritionTab.tsx` import and usage removed
- [x] Lib/hooks removed — `lib/mealDescribe.ts` deleted; `MacroSource` / `ParsedFoodItem` / `MealItem` dropped from `types/nutrition.ts`; `addLogs()` dropped from `useNutritionLogs`; textarea placeholder rule dropped from `index.css`
- [x] Edge functions removed — `open-food-facts-proxy/` and `usda-proxy/` deleted from the repo and from Supabase (`functions delete`); `config.toml` back to the single `anthropic-proxy` entry
- [x] Verified — `web/` and `supabase/` are byte-identical to pre-feature commit `9261b94` (`git diff --stat 9261b94` is empty); label scanner, daily total strip, goals and today's log all bit-for-bit unchanged
- [x] Build passing (852 modules, was 854) + zero references to Open Food Facts / meal description in source *or* the built bundle + git pushed

> `usda-proxy` was deleted rather than reverted: it never existed before this
> feature. See PROMPT.md → Outcome.

---

## Nutrition Scanner Tab (still live)
- [x] Supabase schema + migration — 052_nutrition_scanner.sql applied (nutrition_logs, nutrition_goals, RLS, realtime)
- [x] New tab added to navigation — "Nutrition" (scan-line icon) between Workout and Budget; rail, dock and swipe order all read from TABS
- [x] Camera/image upload UI — LabelScanner states 1–4; `capture="environment"` for camera, plain picker for upload
- [x] Claude vision API call (via anthropic-proxy Edge Function) — lib/nutritionScan.ts; proxy already forwards `messages` untouched, so image blocks pass through
- [x] Macro result card with edit fields — MacroResultCard (shared by scan result and edit sheet)
- [x] Add to daily total flow — optimistic insert in useNutritionLogs
- [x] Daily total strip — DailyTotalStrip + GoalSheet (nutrition_goals upsert, progress bars when goals set)
- [x] Log history (today's entries) — TodayLog with swipe-left + trash delete, tap to edit in a bottom sheet
- [x] Build passing + git pushed

### Follow-up — multi-label scans
- [x] Multiple images per scan (cap 6), each with its own "Amount eaten" input
- [x] Fraction-of-container math ("1/5th of this" = whole container ÷ 5, via servings per container)
- [x] Per-label macros summed in code, not by the model; breakdown shown on the result card
- [x] Meal prep toggle (2+ labels): amounts describe the whole batch, logs `eating/makes` of the total
