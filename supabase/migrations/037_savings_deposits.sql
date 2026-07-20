-- Custom weekly savings deposits: how much to put away each pay-day week.
--
-- One row per (budget, week_start Thursday). These are the contributions that
-- feed the running savings balance (see budget_savings_account / migration 036):
-- a month's contribution = the sum of its pay-day deposits, and the running
-- balance sums them across months. Replaces the old flat "Savings group amount
-- × 4" contribution with a per-week custom amount.

create table if not exists public.budget_savings_deposits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  budget_id  uuid not null references public.budgets (id) on delete cascade,
  week_start date not null, -- the pay-day Thursday
  amount     numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (budget_id, week_start)
);

create index if not exists budget_savings_deposits_budget_week_idx
  on public.budget_savings_deposits (budget_id, week_start);

alter table public.budget_savings_deposits enable row level security;
drop policy if exists "budget_savings_deposits_all_own" on public.budget_savings_deposits;
create policy "budget_savings_deposits_all_own" on public.budget_savings_deposits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_savings_deposits;
  exception when duplicate_object then null;
  end;
end $$;
