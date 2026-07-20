-- ============================================================================
-- 035_budget_credit_card.sql — credit-card payoff expense groups.
--
-- A budget_group can be a 'credit_card' kind: instead of a flat amount it stores
-- a total owed, a due date, and a number of weeks. The app divides the total by
-- the weeks to get a weekly payment, counted only in the weeks leading up to the
-- due date. Standard groups are unaffected (kind defaults to 'standard').
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.budget_groups
  add column if not exists kind text not null default 'standard',
  add column if not exists cc_total numeric not null default 0,
  add column if not exists cc_weeks integer not null default 0,
  add column if not exists cc_due_date date;
