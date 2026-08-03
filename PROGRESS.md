# Session Progress

## Describe Your Meal Feature
- [x] USDA proxy updated to support natural language search — **created**, not updated: the old USDA proxy was removed 2026-06-29, so `supabase/functions/usda-proxy/` is new. `type: "describe"` searches Foundation + SR Legacy, drops branded and nutrient-less rows, ranks Foundation first, returns top 3 per-100g. `USDA_API_KEY` secret was still set. Deployed.
- [x] Open Food Facts proxy Edge Function created — `cgi/search.pl` first, falling back to Search-a-licious (`search.openfoodfacts.org`) because `world.openfoodfacts.org` now answers anonymous text search with a 503 interstitial. Deployed.
- [x] Claude meal parser (identifies foods from description) — `lib/mealDescribe.ts` `parseMeal()`; returns items with quantity, unit, `quantity_grams`, `is_branded`, `search_query`. Empty/invalid JSON throws `MealParseError` → the "be more specific" message.
- [x] Multi-source lookup logic (USDA → Open Food Facts → Claude estimate) — `resolve()` per item, all items via one `Promise.all`. Generic: USDA → OFF → estimate. Branded: OFF → USDA → estimate.
- [x] Meal breakdown result UI — `MealDescriber.tsx`; OR divider, textarea, per-item rows with green/blue/amber source badges, TOTAL row, loading card with cross-fading status text.
- [x] Edit and add to daily total flow — rows expand to editable quantity + 4 macros; "Add all to my day" writes one `nutrition_logs` row per item via the new optimistic `addLogs()` in `useNutritionLogs`.
- [x] Build passing + git pushed

### Notes / deviations
- The prompt said to UPDATE `usda-proxy`; it did not exist (removed 2026-06-29), so it was created.
- `world.openfoodfacts.org` intermittently 503s anonymous text search (both `cgi/search.pl` and `api/v2/search`). The proxy tries `cgi/search.pl` first and falls back to Search-a-licious. Search-a-licious does not index `serving_size`/`serving_quantity`, so those come back null on the fallback path — display-only, the macro math uses grams from the parse step.
- Added a relevance guard to the OFF proxy (not in the prompt): a product must share a whole word with the query. Without it OFF answered "Big Mac" with "Original macaroni & cheese dinner" (substring hit on "mac"), which would have been logged under a blue verified badge.
- Branded items fall through to USDA before the Claude estimate — a real SR Legacy row beats a guess.

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
