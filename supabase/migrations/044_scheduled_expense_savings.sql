-- ============================================================================
-- 044_scheduled_expense_savings.sql — let a savings pool earmark money toward a
-- scheduled (one-off) expense, the same way it already does toward a group.
--
-- budget_savings_earmarks.group_id is a NOT-NULL FK to budget_groups, so
-- scheduled-expense earmarks can't live there. This table mirrors it, keyed by
-- (pool_id, scheduled_expense_id): how much of a month's savings pool is set
-- aside toward that one-off expense. The net the expense still needs from income
-- = amount − earmark. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.budget_savings_expense_earmarks (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  pool_id              uuid not null references public.budget_savings_pools (id) on delete cascade,
  scheduled_expense_id uuid not null references public.budget_scheduled_expenses (id) on delete cascade,
  amount               numeric not null default 0,
  created_at           timestamptz not null default now(),
  unique (pool_id, scheduled_expense_id)
);

create index if not exists budget_savings_expense_earmarks_pool_idx
  on public.budget_savings_expense_earmarks (pool_id);

alter table public.budget_savings_expense_earmarks enable row level security;
drop policy if exists "budget_savings_expense_earmarks_all_own" on public.budget_savings_expense_earmarks;
create policy "budget_savings_expense_earmarks_all_own" on public.budget_savings_expense_earmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_savings_expense_earmarks;
  exception when duplicate_object then null;
  end;
end $$;
