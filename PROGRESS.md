# Session Progress

## Changes
- [x] Remove nutrition tab entirely — components/nutrition/, hooks/nutrition/, types/nutrition.ts, lib/nutritionScan.ts deleted; tab dropped from TABS + App.tsx; `.nutrition-scope` removed from index.css. Edge functions were already gone. DB tables dropped via migration 054 (user confirmed; nutrition_logs + nutrition_goals permanently deleted).
- [x] Fix charge day logic (no longer affects weekly amount) — `groupPayoffFor` no longer divides by pay-days-until-charge; every weekly amount now comes from `weeklyFromMonthly(monthly, month)` = monthly ÷ Thursdays-in-month. Verified numerically: 5 charge days → 1 distinct weekly amount.
- [x] Add float savings toggle — `budget_groups.float_savings` (migration 053); toggle in the new GroupEditPanel, shown only when a charge day is set; "⚡ Charges this week" amber marker in the Paycheck view. Display only.
- [x] Add monthly override per recurring cost — `budget_group_overrides` (migration 053) + `useGroupOverrides`; ONE resolver `resolvedMonthlyOf()` in BudgetView feeds every display and total.
- [x] Rework snapshot to running total view — built, then **removed at the user's request** (2026-08-02). `SetAsideSnapshot` + `useAmountSetAside` deleted from both the Snapshot and Overview views; the manual "I've set aside" entry was unwanted. The old income/allocated/remaining strip and the 4-tile grid + "Where it goes" card stay removed, so the Snapshot now leads with Savings growth and the Overview leads with the table.
- [x] Build passing + git pushed

### Notes
- `weeksInMonth` counts the month's **Thursdays** — this app's weeks run Thursday–Wednesday, not Monday-start as the prompt assumed. July 2026 = 5, August 2026 = 4, matching the prompt's example counts.
- Schema split across `053_budget_improvements.sql` and `054_remove_nutrition.sql` (rather than one file) so the safe additions could ship without waiting on the destructive, irreversible drop. Both applied; local and remote history in sync through 054.
- `GroupCard.tsx` and `SummaryStrip.tsx` were already dead code before this session and were left alone.
- `budget_periods.amount_set_aside` (migration 053) is now an unused column. Left in place rather than adding a destructive drop migration for a harmless empty column.
