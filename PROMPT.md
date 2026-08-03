# "Describe Your Meal" — Claude Code Prompt

> Supersedes the previous PROMPT.md (Nutrition Label Scanner Tab — complete).

## FIRST THING TO DO — SESSION MANAGEMENT

Before doing anything else:

1. Check if PROMPT.md exists at the project root — save this
   prompt there if not, commit and push.
2. Check if PROGRESS.md exists — create it if not with all
   items unchecked, commit and push.
   If it exists, resume from first incomplete item.

PROGRESS.md format:
# Session Progress

## Describe Your Meal Feature
- [ ] USDA proxy updated to support natural language search
- [ ] Open Food Facts proxy Edge Function created
- [ ] Claude meal parser (identifies foods from description)
- [ ] Multi-source lookup logic (USDA → Open Food Facts → Claude estimate)
- [ ] Meal breakdown result UI
- [ ] Edit and add to daily total flow
- [ ] Build passing + git pushed

After completing each item:
  git add PROGRESS.md && git commit -m "Progress: [item] complete" && git push

To resume: "Read PROMPT.md and PROGRESS.md and resume where you left off."

---

Add a "Describe your meal" feature to the existing Nutrition
Scanner tab. This is a second input method alongside the
existing label scanner — the user types a natural language
meal description, Claude identifies each food item, looks
them up in USDA and Open Food Facts for verified macro data,
and returns an accurate per-item breakdown. No new tab needed —
add it to the existing Nutrition tab. Follow UI_SKILL.md.

===========================
APIs BEING USED
===========================

1. USDA FoodData Central (already in project)
   Best for: whole foods, generic ingredients, raw produce
   Base: https://api.nal.usda.gov/fdc/v1
   Auth: USDA_API_KEY Supabase secret (already set)
   Key endpoint: GET /foods/search?query={q}&api_key={key}&dataType=Foundation,SR Legacy&pageSize=5

2. Open Food Facts (no API key needed)
   Best for: packaged foods, branded items, anything with a barcode
   Base: https://world.openfoodfacts.org
   Key endpoint: GET /cgi/search.pl?search_terms={q}&json=true&page_size=5&fields=product_name,nutriments,serving_size,brands
   No auth required — just hit the URL

===========================
BACKEND — EDGE FUNCTIONS
===========================

UPDATE existing usda-proxy Edge Function:
  Add support for a new request type: "describe"
  When type = "describe":
    query is a single food item name (not a full meal)
    Search USDA with: dataType=Foundation,SR Legacy (generic foods only)
    Return top 3 results with: fdcId, description,
    nutrients (calories, protein, carbs, fat per 100g),
    foodPortions array
    Prefer Foundation Food > SR Legacy data types
    Filter out any result with brandOwner populated
    (keep USDA strictly for generic/whole foods)

CREATE new open-food-facts-proxy Edge Function:
  supabase/functions/open-food-facts-proxy/index.ts

  Accepts POST: { query: string }
  Requires valid Supabase auth JWT — return 401 if missing

  Fetches:
    https://world.openfoodfacts.org/cgi/search.pl
    ?search_terms={query}
    &json=true
    &page_size=5
    &fields=product_name,nutriments,serving_size,
      serving_quantity,brands,image_front_small_url

  From each result, extract and return:
    name: product_name + (brands if present)
    calories_100g: nutriments['energy-kcal_100g']
    protein_100g: nutriments['proteins_100g']
    carbs_100g: nutriments['carbohydrates_100g']
    fat_100g: nutriments['fat_100g']
    serving_size: serving_size (string label)
    serving_quantity_g: serving_quantity (numeric grams)

  Filter out results where calories_100g is null or 0
  (incomplete entries are useless)

  Handle CORS correctly.
  Handle network errors gracefully — if Open Food Facts
  is unreachable, return empty array with a flag:
  { results: [], unavailable: true }

===========================
FRONTEND — UI ADDITION
===========================

In the existing Nutrition tab, add a second input method
above or below the existing camera/upload scanner section.
Separate the two methods with a clear visual divider and
a small label:

  ── OR ─────────────────────────────────────────────

DESCRIBE YOUR MEAL INPUT:
  A multiline text input with placeholder:
  "Describe what you ate...
   e.g. 'a Big Mac and medium fries' or
   '200g grilled chicken with a cup of white rice
   and some broccoli'"

  Below the input:
  "Analyze Meal" button — primary style, full width

===========================
MEAL ANALYSIS FLOW
===========================

When "Analyze Meal" is tapped:

STEP 1 — CLAUDE IDENTIFIES FOOD ITEMS
Send the meal description to Claude via anthropic-proxy:

  System prompt:
  "You are a food identification assistant. Parse the
  user's meal description into individual food items
  with quantities. Return ONLY a JSON array with no
  other text:
  [
    {
      item: string (clean food name for database lookup,
        e.g. 'grilled chicken breast' not 'some chicken'),
      quantity: number (numeric amount),
      unit: string (g, oz, cup, piece, slice, tbsp etc),
      quantity_grams: number (your best conversion to grams —
        e.g. 1 cup rice = 186g, 1 Big Mac = 214g),
      is_branded: boolean (true if this is a specific
        branded/restaurant item like Big Mac, Chobani,
        Doritos — false for generic items like chicken, rice),
      search_query: string (optimized search term for
        database lookup — keep it simple, 2-4 words)
    }
  ]"

  User message: the meal description text

STEP 2 — LOOK UP EACH FOOD ITEM
For each item in Claude's response, run a lookup
in this priority order:

  IF is_branded = false (generic whole food):
    → Search USDA via usda-proxy (type: "describe",
      query: item.search_query)
    → If USDA returns results: use the top result
    → If no USDA results: fall through to Open Food Facts

  IF is_branded = true (branded/restaurant item):
    → Search Open Food Facts via open-food-facts-proxy
      (query: item.search_query)
    → If Open Food Facts returns results: use the top result
    → If no results: use Claude's own estimate (see below)

  FALLBACK — Claude estimate:
    If neither database has the item, use a third
    Claude call to estimate macros:
    "Estimate the macros per 100g for [item name].
    Return only JSON: { calories: N, protein_g: N,
    carbs_g: N, fat_g: N, confidence: 'estimate' }"
    Mark this item with source: 'estimate' for display

Run all lookups in parallel (Promise.all) for speed.

STEP 3 — CALCULATE MACROS FOR EACH ITEM
For each item, calculate macros for the actual quantity:

  macro_value = (per_100g_value / 100) * quantity_grams

  Use item.quantity_grams from Claude's parsing step.

  Result per item:
  {
    name: string,
    quantity_display: string (e.g. "200g", "1 cup", "1 piece"),
    calories: number (rounded to nearest whole number),
    protein_g: number (rounded to 1 decimal),
    carbs_g: number (rounded to 1 decimal),
    fat_g: number (rounded to 1 decimal),
    source: 'usda' | 'open_food_facts' | 'estimate',
    editable: true
  }

STEP 4 — SHOW RESULTS
Display a breakdown card for the full meal:

  YOUR MEAL BREAKDOWN
  ─────────────────────────────────────────

  For each food item, one row:
  [Item name + quantity]        [Cal: XXX]
  P: Xg  C: Xg  F: Xg         [source badge]

  Source badge:
    "USDA" — small green badge
    "Open Food Facts" — small blue badge
    "Estimated" — small amber badge
      (with tooltip: "Claude estimate —
      verify if accuracy matters")

  ─────────────────────────────────────────
  TOTAL
  Calories: XXX  P: Xg  C: Xg  F: Xg
  ─────────────────────────────────────────

  Each item row is tappable — tapping expands it
  to show editable inputs for all four macro values
  and the quantity, so the user can correct anything
  before adding.

  Two buttons at the bottom:
  [Try again]          [Add all to my day]

  "Add all to my day": saves each food item as a
  separate nutrition_log entry (one row per item),
  updates the daily total strip instantly, clears
  the input and result.

  "Try again": clears result, returns to input state.

===========================
LOADING STATE
===========================

While analysis is running (Steps 1-3):
  Show a loading card in place of results:

  Skeleton rows for 3-4 estimated items
  Status text that updates as work progresses:
    "Identifying foods..." (during Step 1)
    "Looking up nutrition data..." (during Step 2)
    "Calculating macros..." (during Step 3)

  Each status text fades in/out with a 200ms transition.

===========================
ERROR STATES
===========================

If Claude can't parse the description into food items
(returns empty array or invalid JSON):
  "Couldn't identify foods in that description.
  Try being more specific — e.g. '200g chicken breast
  and 1 cup white rice' instead of 'my lunch'"

If all lookups fail and Claude estimates are also
unavailable:
  "Having trouble looking up these items. Check your
  connection and try again."

===========================
EDGE FUNCTION DEPLOYMENT
===========================

After creating the new Edge Function:
  npx supabase functions deploy open-food-facts-proxy

The usda-proxy update deploys with:
  npx supabase functions deploy usda-proxy

===========================
SUPABASE MIGRATIONS
===========================

No new tables needed — uses existing nutrition_logs table.
Run migrations if any were pending:
  npx supabase db push

===========================
AUTO DEPLOY
===========================

After everything is complete and npm run build passes:
1. git add .
2. git commit -m "Add describe your meal feature with USDA and Open Food Facts lookup"
3. git push
Do not push if build fails. Confirm push succeeded.

===========================
OUTPUT
===========================
Report each section with ✓ or ✗.
Specifically confirm:
  - USDA returns results for "grilled chicken breast"
  - Open Food Facts returns results for "Chobani yogurt"
  - Parallel lookups are used (not sequential)
  - Estimated items are clearly badged in amber
  - Daily total strip updates immediately after adding

---

## Session note — deviation from the prompt as written

The prompt says "UPDATE existing usda-proxy Edge Function". There is no
`usda-proxy` in this repo: the USDA proxy was **removed on 2026-06-29** along
with the Macro Tracker. `supabase/functions/` contained only `_shared/` and
`anthropic-proxy/`. So `usda-proxy` was **created** this session (with the
`type: "describe"` contract the prompt specifies) rather than updated.
