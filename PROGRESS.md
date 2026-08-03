# Session Progress

## Describe Your Meal Feature
- [x] USDA proxy updated to support natural language search — **created**, not updated: the old USDA proxy was removed 2026-06-29, so `supabase/functions/usda-proxy/` is new. `type: "describe"` searches Foundation + SR Legacy, drops branded and nutrient-less rows, ranks Foundation first, returns top 3 per-100g. `USDA_API_KEY` secret was still set. Deployed.
- [x] Open Food Facts proxy Edge Function created — `cgi/search.pl` first, falling back to Search-a-licious (`search.openfoodfacts.org`) because `world.openfoodfacts.org` now answers anonymous text search with a 503 interstitial. Deployed.
- [ ] Claude meal parser (identifies foods from description)
- [ ] Multi-source lookup logic (USDA → Open Food Facts → Claude estimate)
- [ ] Meal breakdown result UI
- [ ] Edit and add to daily total flow
- [ ] Build passing + git pushed

---

## Nutrition Scanner Tab (previous session — complete)
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
