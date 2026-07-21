-- ============================================================================
-- 041_scheduled_expense_pay_date.sql — let a scheduled expense target a specific
-- pay date (Thursday) within its month, not just the month.
--
-- due_date is the exact pay-day Thursday the user plans to spend it on. due_month
-- (first of that month) is kept for the month grouping in the overview. When
-- due_date is set the expense also surfaces on that paycheck in the Paycheck
-- view. Nullable so existing month-only rows keep working. Idempotent.
-- ============================================================================

alter table public.budget_scheduled_expenses
  add column if not exists due_date date;
