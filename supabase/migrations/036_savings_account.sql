-- Savings account: a running balance per budget.
--
-- The balance is NOT stored directly — it is computed as:
--   starting_balance
--   + (monthly "Savings" category amount) × months since start_month
--   − (sum of savings allocations/earmarks across those months)
--
-- so it grows each month by what you budget into savings and is drawn down as
-- you allocate savings toward expenses. We persist only the starting point.

create table if not exists public.budget_savings_account (
  budget_id       uuid primary key references public.budgets (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  starting_balance numeric not null default 0,
  start_month     date not null default date_trunc('month', now())::date,
  created_at      timestamptz not null default now()
);

alter table public.budget_savings_account enable row level security;
drop policy if exists "budget_savings_account_all_own" on public.budget_savings_account;
create policy "budget_savings_account_all_own" on public.budget_savings_account
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_savings_account;
  exception when duplicate_object then null;
  end;
end $$;
