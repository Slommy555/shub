-- ============================================================================
-- 040_scheduled_expenses.sql — Budget Fixes Round 2: scheduled (one-off)
-- expenses and simple credit-card weekly line items.
--
-- budget_scheduled_expenses: an irregular/one-off cost due in a specific month
-- (stored as the first day of that month). It counts toward that month's MONTHLY
-- total only — never weekly, never repeats.
--
-- budget_credit_cards: a card name + a flat WEEKLY payment. Counts toward the
-- weekly remaining; a ×4 monthly figure is shown for reference only. This is the
-- simplified model — the older kind='credit_card' budget_groups + payoff columns
-- and budget_credit_card_payments are left in place (unused) rather than dropped.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.budget_scheduled_expenses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  budget_id  uuid not null references public.budgets (id) on delete cascade,
  name       text not null,
  amount     numeric not null default 0,
  due_month  date not null,
  created_at timestamptz not null default now()
);

create index if not exists budget_scheduled_expenses_budget_month_idx
  on public.budget_scheduled_expenses (budget_id, due_month);

alter table public.budget_scheduled_expenses enable row level security;
drop policy if exists "budget_scheduled_expenses_all_own" on public.budget_scheduled_expenses;
create policy "budget_scheduled_expenses_all_own" on public.budget_scheduled_expenses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.budget_credit_cards (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  budget_id      uuid not null references public.budgets (id) on delete cascade,
  name           text not null,
  weekly_payment numeric not null default 0,
  position       integer not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists budget_credit_cards_budget_idx
  on public.budget_credit_cards (budget_id);

alter table public.budget_credit_cards enable row level security;
drop policy if exists "budget_credit_cards_all_own" on public.budget_credit_cards;
create policy "budget_credit_cards_all_own" on public.budget_credit_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_scheduled_expenses;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.budget_credit_cards;
  exception when duplicate_object then null;
  end;
end $$;
