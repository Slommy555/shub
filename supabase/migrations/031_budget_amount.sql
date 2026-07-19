-- ============================================================================
-- 031_budget_amount.sql — simplify allocations to a single `amount` per group.
--
-- The Budget tab no longer tracks "budgeted vs spent". Each expense group has a
-- single allocated amount that is subtracted from income to show the remainder.
-- Drop the `spent` column and rename `budgeted` → `amount`. Idempotent.
-- ============================================================================

alter table public.budget_allocations drop column if exists spent;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budget_allocations'
      and column_name = 'budgeted'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'budget_allocations'
      and column_name = 'amount'
  ) then
    alter table public.budget_allocations rename column budgeted to amount;
  end if;
end $$;
