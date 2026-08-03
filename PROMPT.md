# Remove Nutrition Tab + Budget Improvements — Claude Code Prompt

> Supersedes the previous PROMPT.md (remove "Describe Your Meal" — complete).

## FIRST THING TO DO — SESSION MANAGEMENT

Before doing anything else:

1. Check if PROMPT.md exists at the project root — save this
   prompt there if not, commit and push.
2. Check if PROGRESS.md exists — create it if not with all
   items unchecked, commit and push.
   If it exists, resume from first incomplete item.

PROGRESS.md format:
# Session Progress

## Changes
- [ ] Remove nutrition tab entirely
- [ ] Fix charge day logic (no longer affects weekly amount)
- [ ] Add float savings toggle
- [ ] Add monthly override per recurring cost
- [ ] Rework snapshot to running total view
- [ ] Build passing + git pushed

After completing each item:
  git add PROGRESS.md && git commit -m "Progress: [item] complete" && git push

To resume: "Read PROMPT.md and PROGRESS.md and resume where you left off."

---

Two separate things: remove the nutrition tab entirely,
and make several improvements to the budget tab.
Do not touch anything else. Follow UI_SKILL.md.

===========================
PART 1 — REMOVE NUTRITION TAB
===========================

Completely remove the nutrition tab and all related code.

1. FRONTEND
   - Delete src/components/nutrition/ entirely
   - Delete src/hooks/nutrition/ entirely
   - Delete src/types/nutrition.ts if it exists
   - Remove the Nutrition tab from the main navigation
   - Remove all nutrition-related imports from App.tsx
     or any nav/router file
   - Remove any nutrition-related Claude action types
     from claudeActions.ts (log_nutrition or similar)

2. EDGE FUNCTIONS
   - If an open-food-facts-proxy function exists: delete it
     npx supabase functions delete open-food-facts-proxy
   - Remove any "describe" or nutrition-related request
     types added to usda-proxy — if usda-proxy was ONLY
     used for nutrition, delete it entirely:
     npx supabase functions delete usda-proxy
   - If usda-proxy is used elsewhere in the app:
     only remove nutrition-specific additions,
     leave the rest intact

3. DATABASE
   Create migration 00X_remove_nutrition.sql:
     DROP TABLE IF EXISTS nutrition_logs;
     DROP TABLE IF EXISTS nutrition_goals;
   Note in output: this permanently deletes any logged
   nutrition data. Flag clearly before applying.

4. VERIFY
   - npm run build passes with zero nutrition references
   - Nav has no nutrition tab entry
   - All other tabs still work

===========================
PART 2 — BUDGET IMPROVEMENTS
===========================

--- FIX 1: CHARGE DAY DOES NOT AFFECT WEEKLY AMOUNT ---

THE PROBLEM:
When a charge day is set on a recurring cost (e.g. the 15th),
it is incorrectly changing the weekly set-aside amount.

THE FIX:
The weekly set-aside amount must ALWAYS be:
  monthly_amount / number_of_weeks_in_month

regardless of when the charge day falls. The charge day
is metadata only — it tells us WHEN the bill hits,
not HOW MUCH to set aside each week.

Find every place in the codebase where weekly amounts
are calculated and confirm the charge day field is not
being factored into the division. Remove it from any
calculation it appears in.

Number of weeks in a month calculation:
  Use the number of Mondays (or whatever the week start
  day is set to) that fall within the calendar month.
  e.g. July 2026 has 5 Mondays = divide by 5
  e.g. August 2026 has 4 Mondays = divide by 4
  This is the existing logic — just make sure charge
  day is not interfering with it.

--- FIX 2: FLOAT SAVINGS TOGGLE ---

Add a "Float Savings" toggle to each recurring cost item
(in the expanded/edit view of a group card).

WHAT IT DOES:
When Float Savings is OFF (default):
  Weekly set-aside = monthly_amount / weeks_in_month
  Same amount every week regardless of charge day.
  Charge day marker still shows which week the bill hits
  (see below) but does not change the amount.

When Float Savings is ON:
  Weekly set-aside is still the same evenly divided amount
  BUT the week containing the charge day is visually
  marked in the paycheck view (see charge day marker below).
  The amount does NOT change — only the marker appears.
  "Float savings" means you're aware the charge hits
  that week and your savings are floating to cover it,
  not that you set aside more that week.

CHARGE DAY MARKER:
In the paycheck view, when a recurring cost has a charge
day set AND float savings is ON:
  - If the current paycheck week contains the charge day:
    Show a small indicator next to that recurring cost:
    "⚡ Charges this week" in --color-warning (amber)
    Small text, inline with the group name
  - If the paycheck week does NOT contain the charge day:
    Show nothing extra — normal display

SCHEMA ADDITION:
Add to budget_groups table (new migration):
  ALTER TABLE budget_groups
    ADD COLUMN IF NOT EXISTS float_savings boolean default false;

TOGGLE UI:
In the expanded group card edit panel:
  Float Savings  [toggle switch]
  Small helper text below:
  "Marks the charge week in your paycheck view
  without changing your weekly set-aside amount"

  Only show this toggle if a charge day is already set
  for this group. If no charge day is set, hide the
  float savings toggle entirely.

--- FIX 3: MONTHLY OVERRIDE PER RECURRING COST ---

Allow a one-time override of a recurring cost's amount
for a specific month, without changing the default
amount for all other months.

USE CASE:
Car insurance is normally $180/month. In March it's
$210 due to a policy change. Set a March override of
$210 — all other months still show $180 automatically.

SCHEMA ADDITION (add to same migration):
  CREATE TABLE IF NOT EXISTS budget_group_overrides (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users,
    group_id uuid references budget_groups(id)
      on delete cascade,
    budget_id uuid references budgets(id)
      on delete cascade,
    month date not null
      (store as first day of month e.g. 2026-03-01),
    override_amount numeric not null,
    note text nullable
      (optional reason e.g. "Policy renewal"),
    created_at timestamptz default now(),
    UNIQUE (group_id, month)
  );
  ALTER TABLE budget_group_overrides
    ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Users own overrides"
    ON budget_group_overrides FOR ALL
    USING (auth.uid() = user_id);

AMOUNT RESOLUTION LOGIC:
When displaying or calculating a group's monthly amount:
  1. Check if a budget_group_overrides record exists
     for this group_id + current month
  2. If override exists: use override_amount
  3. If no override: use the group's default
     monthly amount from budget_allocations

This resolution must happen in ONE shared function
used everywhere amounts are displayed or summed.

UI — MONTHLY OVERRIDE:
In the expanded group card edit panel, below the
main amount input:

  [Default: $180/mo]

  This month: [ $180    ] [Override ▾]

  - "This month" input shows the resolved amount
    (override if exists, default if not)
  - If this month matches an override: show a small
    amber indicator "Override active" next to the input
    and an X button to remove the override
  - Tapping "Override ▾" or editing the "This month"
    input: saves an override record for the current month
  - The override input only affects the current month —
    all other months use the default
  - Optional note field appears when override is active:
    "Add a note (e.g. 'Policy renewal')" — saves to
    budget_group_overrides.note
  - Removing the override (X button): deletes the
    override record, reverts to default for that month

--- FIX 4: REWORK SNAPSHOT TO RUNNING TOTAL VIEW ---

Replace the current snapshot/summary strip with a
running total view focused on savings progress
toward end-of-month needs.

WHAT TO SHOW:
The snapshot answers: "How much have I set aside so far
this month, and how much do I still need by end of month?"

NEW SNAPSHOT LAYOUT:
Replace the existing summary strip with this card
at the top of the budget tab (above the weekly/monthly
table and above the budget switcher):

┌─────────────────────────────────────────────────────┐
│  JULY 2026                                          │
│                                                     │
│  Set aside so far    Needed by end of month         │
│  $X,XXX              $X,XXX                         │
│                                                     │
│  [Progress bar: set aside / total needed]           │
│                                                     │
│  Remaining to set aside: $X,XXX                     │
│  (or "On track ✓" if set aside >= needed so far)   │
└─────────────────────────────────────────────────────┘

CALCULATIONS:
  Total needed by end of month:
    Sum of all recurring group resolved amounts
    (with overrides applied) for this month
    PLUS sum of scheduled expenses due this month
    MINUS sum of savings pool earmarks for this month
    = total that needs to come from income this month

  Set aside so far:
    This is a manually-logged value — the user inputs
    how much they've actually moved to savings/bill
    payment so far this month
    Add a simple input field in the snapshot card:
    "I've set aside: [ $0    ]"
    Saves to a new column: budget_periods.amount_set_aside
    (add via migration: ALTER TABLE budget_periods
    ADD COLUMN IF NOT EXISTS amount_set_aside numeric
    default 0)

  Remaining to set aside:
    total_needed - amount_set_aside
    If remaining <= 0: show "On track ✓" in
    --color-success instead of a negative number

  Progress bar:
    Fill = amount_set_aside / total_needed
    Color: --color-accent if under 100%,
    --color-success if at or over 100%
    Cap bar at 100% width even if over-funded

WEEK INDICATOR:
Below the progress bar, small text in
--color-text-secondary:
  "Week X of Y this month · $X/week to stay on track"

  Where:
    X = current week number within the month (1, 2, 3 etc)
    Y = total weeks in the month
    $X/week = remaining_to_set_aside / remaining_weeks

This gives a simple weekly action item without
cluttering the snapshot.

REMOVE:
  - The old income / allocated / remaining strip
  - The old "From Savings / Needs Funding" 4-value grid
  Replace entirely with this new snapshot card.
  The detailed numbers (income, group amounts, etc.)
  are still available in the main table below —
  the snapshot just shows the savings progress view.

===========================
SUPABASE MIGRATIONS
===========================

Collect all schema changes into one migration file:
00X_budget_improvements.sql:
  - DROP TABLE nutrition_logs (if removing nutrition)
  - DROP TABLE nutrition_goals (if removing nutrition)
  - ALTER TABLE budget_groups ADD float_savings
  - CREATE TABLE budget_group_overrides
  - ALTER TABLE budget_periods ADD amount_set_aside

Run:
  npx supabase db push
If duplicate key error: npx supabase migration list,
skip already-applied.

===========================
AUTO DEPLOY
===========================

After everything is complete and npm run build passes:
1. git add .
2. git commit -m "Remove nutrition tab, budget snapshot rework, float savings, monthly overrides"
3. git push
Do not push if build fails. Confirm push succeeded.

===========================
OUTPUT
===========================
Report each section with ✓ or ✗ and brief summary.
For Fix 1 specifically: confirm charge day is not
present in any weekly calculation anywhere in the
codebase before marking done.
