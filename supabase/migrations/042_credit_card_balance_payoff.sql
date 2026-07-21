-- ============================================================================
-- 042_credit_card_balance_payoff.sql — credit cards become a balance + due-date
-- payoff tracker (replacing the flat weekly payment).
--
-- A card now carries a `balance` (amount owed; scheduled expenses "charged to
-- card" add to it) and an optional `due_date`. Payments are recorded per pay-day
-- in budget_card_payments; the remaining balance = balance − sum(payments), and
-- the suggested payday payment = remaining ÷ pay-days left until the due date.
-- The old weekly_payment column is left in place (unused). Idempotent.
-- ============================================================================

alter table public.budget_credit_cards
  add column if not exists balance numeric not null default 0,
  add column if not exists due_date date;

create table if not exists public.budget_card_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    uuid not null references public.budget_credit_cards (id) on delete cascade,
  pay_date   date not null,
  amount     numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (card_id, pay_date)
);

create index if not exists budget_card_payments_card_idx
  on public.budget_card_payments (card_id);

alter table public.budget_card_payments enable row level security;
drop policy if exists "budget_card_payments_all_own" on public.budget_card_payments;
create policy "budget_card_payments_all_own" on public.budget_card_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_card_payments;
  exception when duplicate_object then null;
  end;
end $$;
