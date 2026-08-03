# Session Progress

## Changes
- [x] Remove nutrition tab entirely — components/nutrition/, hooks/nutrition/, types/nutrition.ts, lib/nutritionScan.ts deleted; tab dropped from TABS + App.tsx; `.nutrition-scope` removed from index.css. Edge functions were already gone. **DB drop staged in 054, not yet applied — destroys logged data, awaiting confirmation.**
- [x] Fix charge day logic (no longer affects weekly amount) — `groupPayoffFor` no longer divides by pay-days-until-charge; every weekly amount now comes from `weeklyFromMonthly(monthly, month)` = monthly ÷ Thursdays-in-month. Verified numerically: 5 charge days → 1 distinct weekly amount.
- [x] Add float savings toggle — `budget_groups.float_savings` (migration 053); toggle in the new GroupEditPanel, shown only when a charge day is set; "⚡ Charges this week" amber marker in the Paycheck view. Display only.
- [x] Add monthly override per recurring cost — `budget_group_overrides` (migration 053) + `useGroupOverrides`; ONE resolver `resolvedMonthlyOf()` in BudgetView feeds every display and total.
- [x] Rework snapshot to running total view — new `SetAsideSnapshot`; `budget_periods.amount_set_aside` (migration 053). Old income/allocated/remaining strip and the 4-tile grid + "Where it goes" card removed.
- [x] Build passing + git pushed

### Notes
- `weeksInMonth` counts the month's **Thursdays** — this app's weeks run Thursday–Wednesday, not Monday-start as the prompt assumed. July 2026 = 5, August 2026 = 4, matching the prompt's example counts.
- Schema went into `053_budget_improvements.sql` (applied). The nutrition DROPs are split into `054_remove_nutrition.sql` so the safe changes could ship without waiting on a destructive, irreversible one.
- `GroupCard.tsx` and `SummaryStrip.tsx` were already dead code before this session and were left alone.
