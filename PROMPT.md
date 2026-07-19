# Session Spec — Budget Tab: Period Isolation, Multiple Budgets, Savings Pool

> Supersedes the previous PROMPT.md (Budget tab rebuild — complete).
> Three fixes/additions to the Budget tab only. Do not touch any other part of
> the app. Follow UI_SKILL.md for all visual decisions.

## FIX 1 — PERIOD ISOLATION
Group amounts set in one period (July) must NOT persist into other periods
(August). Each period is completely independent. When navigating to a period
with no allocations yet, show all groups at $0 / empty inputs — never copy or
inherit amounts from any other period.

Root cause: groups default to `persistent: true`, storing `amount` on the group
row (shared across all periods + scaled across timeframes). Fix: amounts live
per-period in `budget_allocations`; each period starts blank.

Verify: set $500 Food in July → August shows $0 → back to July still $500.

## FIX 2 — MULTIPLE BUDGETS
Independent budgets ("Personal", "Business", "Trip"). Each has its own income,
groups, amounts, and savings pool. Nothing shared.

Schema (new migration): `budgets` table (id, user_id, name, position,
created_at). Add `budget_id` to `budget_periods` + `budget_groups` (cascade).
RLS filters by budget ownership. Data migration: create "My Budget" default and
assign existing rows to it.

UI: budget switcher at top of Budget tab above sub-tabs — `[←] [ Name ▾ ] [→]`.
Picker sheet: list to switch, "New budget", long-press to rename/delete, cannot
delete last, delete warns + cascades. Active budget_id in localStorage; all
queries filter by it.

## FIX 3 — SAVINGS POOL
A pool of set-aside money; earmark dollar amounts toward specific groups. An
earmark offsets that group's cost from income.

Schema: `budget_savings_pools` (id, user_id, budget_id, period_id, total_saved,
UNIQUE(budget_id, period_id)). `budget_savings_earmarks` (id, user_id, pool_id,
group_id, amount, UNIQUE(pool_id, group_id)). RLS on both.

UI: collapsible "Savings Pool" section below groups. Total-set-aside input + one
earmark input per group. Cannot earmark more than total (cap + warning).
Allocated = Σ earmarks; Remaining = total − allocated. Save on blur.

Summary strip (4 values, 2×2 on mobile): Income | From Savings | Needs Funding |
Remaining. Needs Funding = Σ max(0, group.amount − earmark). Remaining = income −
needs funding (green ≥0 / red <0). From Savings = Σ earmarks.

Group card: if earmark > 0 show "🏦 $X from savings" (piggy-bank/vault icon,
--color-success, 12px) + "$Y from income".

## MIGRATIONS
After creating file: `npx supabase db push` (duplicate key → `migration list`,
skip applied).

## AUTO DEPLOY
When complete + `npm run build` passes: git add . && commit "Budget: period
isolation, multiple budgets, savings pool" && push. Never push a failing build.
