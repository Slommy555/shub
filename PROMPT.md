# Remove "Describe Your Meal" — Claude Code Prompt

> Supersedes the previous PROMPT.md ("Describe Your Meal" — built 2026-08-02,
> **removed the same day** at the user's request). The Nutrition Label Scanner
> that preceded it is still live and untouched.

Remove the "Describe your meal" feature and all associated
API integrations from the Nutrition tab. Do not touch the
existing label scanner or daily total functionality.

Specifically remove:

1. FRONTEND
   - The "Describe your meal" text input and
     "Analyze Meal" button
   - The meal breakdown result card (per-item rows,
     source badges, totals)
   - The OR divider between scanner and meal description
   - Any loading/error states specific to the meal
     description flow
   - Any imports or references to the meal analysis
     functions in the Nutrition tab component

2. EDGE FUNCTIONS
   - Delete supabase/functions/open-food-facts-proxy/
     entirely
   - Remove the "describe" request type from the
     usda-proxy Edge Function — revert it to however
     it was before this feature was added
   - Redeploy both:
       npx supabase functions deploy usda-proxy
       npx supabase functions delete open-food-facts-proxy

3. FRONTEND LIB/HOOKS
   - Remove any meal parser functions, multi-source
     lookup logic, or Open Food Facts API client code
     added for this feature
   - Remove any imports of these in other files

4. VERIFY
   - The label scanner still works (camera, upload,
     Claude vision call, result card, add to day)
   - The daily total strip still works
   - Today's log still works
   - npm run build passes with zero references to
     Open Food Facts or meal description anywhere

After completing:
git add . && git commit -m "Remove describe meal feature and Open Food Facts integration" && git push
Confirm push succeeded in output.

---

## Outcome

Done. `web/` and `supabase/` are byte-identical to commit `9261b94` (the last
commit before the feature) — verified with `git diff --stat 9261b94`, which
returns empty.

**One deviation from step 2:** `usda-proxy` was *not* reverted-and-redeployed,
it was **deleted**. It did not exist before this feature — the previous USDA
proxy (`usda-search`) was removed on 2026-06-29 with the Macro Tracker, so
`usda-proxy` was created from scratch earlier that same day. "However it was
before this feature was added" therefore means *absent*. Both `usda-proxy` and
`open-food-facts-proxy` were deleted locally and from Supabase.

**Do not re-add this feature** unless explicitly asked again. The
`USDA_API_KEY` secret is still set on the Supabase project but is once more
unused by any code.
