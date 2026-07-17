# Session Spec — Budget Tab Rebuild (web/)

> Supersedes the previous PROMPT.md (repo reorg + Expo scaffold — complete).
> Rebuild the Budget tab from scratch in the web app. The existing tab is a blank
> placeholder — build on top of it. Do not touch any other tab or feature.
> Follow UI_SKILL.md for all visual decisions.

## SUPABASE SCHEMA — migration 030_budget_rebuild.sql
- **budget_periods**: id uuid pk, user_id uuid → auth.users, type text (weekly|monthly),
  label text, start_date date, end_date date, income numeric default 0, created_at.
  UNIQUE (user_id, type, start_date).
- **budget_groups**: id uuid pk, user_id uuid → auth.users, name text, color text,
  position integer, created_at. (Shared between weekly + monthly.)
- **budget_allocations**: id uuid pk, user_id uuid → auth.users, period_id uuid →
  budget_periods on delete cascade, group_id uuid → budget_groups on delete cascade,
  budgeted numeric default 0, spent numeric default 0. UNIQUE (period_id, group_id).
- RLS on all three; users read/write only their own rows. Realtime enabled.

## TAB STRUCTURE
Two sub-tabs at top: [ Weekly ] [ Monthly ]. Same layout/logic; only period type +
date range differ. Default Weekly on first visit. Remember last sub-tab in localStorage.

## WEEKLY / MONTHLY SUB-TAB
- Period nav: ‹ | label | › (weekly = "Jun 29 – Jul 5" Mon–Sun; monthly = "July 2026").
  Auto-create a budget_periods row (income 0) when navigating to a period with none.
- Income entry: "Income this week/month", large currency input, placeholder "$0.00",
  saves to budget_periods.income on blur/Enter, subtle "Saved" confirmation.
- Summary strip: Income | Spent | Remaining (text-2xl/700, muted labels). Spent = sum of
  allocations.spent. Remaining = income − spent, green if ≥0 else red. Recalcs instantly.
- Expense groups: card per group — color dot + name, "$spent / $budgeted" right-aligned
  (spent red if over), progress bar (accent fill, danger if over, capped 100% visually).
  Tap card → inline edit panel (budgeted + spent inputs, save on blur). Auto-create an
  allocation (0/0) when first tapped.
- Add group: inline form at bottom — name input + 8 preset color swatches
  (#e05c5c #f0a04b #f5e642 #4caf82 #5c9eff #b8a9f5 #f572b8 #8b8aa8) + Add.
- Reorder: long-press → drag → save position on release.
- Delete: swipe left → red Delete → confirm "Delete [name]? This will remove it from all
  periods." → cascade deletes allocations.
- Groups are SHARED across weekly + monthly; only allocations are per-period.

## MOBILE (<640px)
Full-width nav/inputs/cards; summary = 3 equal centered columns; inline panel stacks;
inputs ≥48px height, large font.

## EMPTY STATE
No groups: centered "No expense groups yet" (text-tertiary) + subtitle "Tap the button
below to add your first group". No emoji/illustration. Add button stays visible.

## REAL-TIME SYNC
Optimistic UI (local first, background write). Summary recalcs client-side instantly.
Subscribe to realtime on budget_periods + budget_allocations.

## FILE STRUCTURE (web/src)
components/budget/: BudgetTab, BudgetPeriodView, IncomeInput, SummaryStrip, GroupCard,
AddGroupForm. hooks/budget/: useBudgetPeriod, useBudgetGroups, useBudgetAllocations,
useBudgetSummary. types/budget.ts.

## MIGRATIONS
After creating file: `npx supabase db push` (if duplicate key: `migration list`, skip applied).

## AUTO DEPLOY
When complete and `npm run build` passes: git add . && commit "Budget tab rebuild —
weekly/monthly with income and expense groups" && push. Never push a failing build.

Note: UI_SKILL.md's `--color-*` tokens are not defined in the web app (it uses Tailwind
grays). They are injected scoped to a `.budget-scope` wrapper so the budget tab follows
UI_SKILL exactly without affecting any other tab.
