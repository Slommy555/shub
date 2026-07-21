# Budget Fixes Round 2 — Claude Code Prompt

> Supersedes the previous PROMPT.md.
> Multiple budget fixes. Do not touch anything outside the budget tab.
> Follow UI_SKILL.md for all visual decisions.

## FIX 1 — STRICT CALENDAR MONTHS, NO 30-DAY BINS
Periods are strict calendar months only. start_date = first day of month,
end_date = last day, label "July 2026". A payday on July 30 counts for July.
Nav arrows move one calendar month. Remove any 30-day bin logic.
(STATUS: already satisfied by periodForCursor; no bin logic exists.)

## FIX 2 — AMOUNT PERSISTENCE BUG
Amounts must be isolated per period. Every allocation read/write filters by
current budget_id AND period_id. Navigating to a month with no records shows
blank/$0 — never copy/inherit from another period. Records created only when
the user types a value.
Verification: (1) Rent=$1,200 in July (2) August shows blank (3) Rent=$900 in
Aug (4) back to July still $1,200 (5) September blank.

## FIX 3 — SAVINGS CANCELLATION LOGIC (ORDER-INDEPENDENT)
ONE shared util: net_amount = max(0, group.amount − earmark.amount). Applied
everywhere amounts are displayed/summed. Fully covered → "$0/Covered" in
--color-success, not counted in "needs funding". Partial → remainder shown +
secondary "($XXX from savings)" line in --color-success; only remainder counts.

## FIX 4 — EXPENSE GROUPS vs INDIVIDUAL EXPENSES
Section 1 "Recurring Fixed Costs": existing groups (group | monthly | weekly);
savings earmarks apply here. Section 2 "Scheduled Expenses": one-off/irregular,
table Name | Amount | Due Month (dropdown: this / +1 / +2 months). Only appears
& counts in the month due; monthly lump only (not weekly). Add + swipe-delete.
Table budget_scheduled_expenses(user_id, budget_id, name, amount, due_month).

## FIX 5 — CREDIT CARD WEEKLY PAYMENT
"Credit Card Payments" section between Recurring and Scheduled. Card | Weekly |
~Monthly(weekly×4, tertiary, informational, not counted monthly). Weekly counts
toward weekly remaining. Add + swipe-delete.
Table budget_credit_cards(user_id, budget_id, name, weekly_payment, position).

## SUMMARY CALCULATIONS
Monthly remaining = monthly income − recurring net monthly − scheduled this
month. (CC ×4 shown separately, not folded in.)
Weekly remaining = weekly income − recurring net weekly − CC weekly.
Scheduled NOT subtracted from weekly.

## LAYOUT (top→bottom)
Switcher / Overview|Paycheck toggle / Income / Recurring Fixed Costs /
Credit Card Payments / Scheduled Expenses (this month) / Savings pool / Summary.

## MIGRATIONS: npx supabase db push (skip already-applied on duplicate).
## AUTO DEPLOY: build must pass, then git add/commit/push.
## OUTPUT: report each fix ✓/✗; Fix 2 include all 5 verification steps.
