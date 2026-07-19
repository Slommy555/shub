-- ============================================================================
-- 032_budget_standalone.sql — the Budget tab is now a single persistent budget
-- (no weekly/monthly split). Allow a 'standalone' period type so one singleton
-- budget_periods row per user can hold the income. Old weekly/monthly rows are
-- left in place (harmless, simply no longer shown). Idempotent.
-- ============================================================================

alter table public.budget_periods drop constraint if exists budget_periods_type_check;
alter table public.budget_periods
  add constraint budget_periods_type_check
  check (type in ('weekly', 'monthly', 'standalone'));
