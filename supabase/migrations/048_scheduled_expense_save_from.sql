-- ============================================================================
-- 048_scheduled_expense_save_from.sql — let a scheduled expense choose WHICH pay
-- period it starts saving on, instead of always starting the week it was created.
--
-- save_from_date is a pay-day Thursday on/before due_date. The flat weekly
-- set-aside is spread across the pay days from save_from_date through due_date,
-- and the expense doesn't surface on paychecks before it. Nullable — existing
-- rows fall back to their created_at date, the old automatic behaviour.
-- Idempotent.
-- ============================================================================

alter table public.budget_scheduled_expenses
  add column if not exists save_from_date date;
