-- ============================================================================
-- 051_savings_adjustments.sql — dated manual adjustments to the running savings
-- balance, so real-world moves that the budget tracker never sees (a cash
-- deposit, an unplanned withdrawal, interest, a transfer between accounts) still
-- land on the balance and its trend line.
--
-- The savings balance stays DERIVED. It is now:
--   starting_balance
--   + Σ budget_savings_deposits (dated on their pay-day Thursday)
--   − Σ savings earmarks/allocations (dated on their month's first day)
--   + Σ budget_savings_adjustments (signed, dated)
--
-- kind:
--   'manual'  — an entry the user added outright ("+$200, tax refund").
--   'balance' — the delta written when the user EDITS a day/week/month balance in
--               the Snapshot's savings trend. One per (budget, date): editing the
--               same bucket again rewrites that row instead of stacking a second
--               correction. Stored as a delta on purpose, so later deposits and
--               allocations still move the balance after a hand-edit.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.budget_savings_adjustments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  budget_id  uuid not null references public.budgets (id) on delete cascade,
  adj_date   date not null,
  amount     numeric not null default 0, -- signed: + added, − taken out
  kind       text not null default 'manual' check (kind in ('manual', 'balance')),
  note       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists budget_savings_adjustments_budget_date_idx
  on public.budget_savings_adjustments (budget_id, adj_date);

-- At most one balance-edit row per date per budget (manual entries are unlimited).
create unique index if not exists budget_savings_adjustments_one_balance_per_day
  on public.budget_savings_adjustments (budget_id, adj_date)
  where kind = 'balance';

alter table public.budget_savings_adjustments enable row level security;
drop policy if exists "budget_savings_adjustments_all_own" on public.budget_savings_adjustments;
create policy "budget_savings_adjustments_all_own" on public.budget_savings_adjustments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_savings_adjustments;
  exception when duplicate_object then null;
  end;
end $$;
