-- ============================================================================
-- 027_credit_card_payoffs.sql — credit card debt payoff planner
-- Run via `supabase db push` or the Supabase SQL Editor (after 019).
--
-- credit_card_payoffs   : one row per card, with the amount spent (balance).
-- credit_card_payments  : scheduled weekly paydowns toward a card (a due date +
--                         amount + paid flag). Remaining balance = total_amount
--                         minus the sum of the card's PAID payments.
-- RLS: each user only sees/edits their own rows. Realtime enabled so the UI and
-- the daily brief stay in sync across devices.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- payoffs (one per card) -------------------------------------------------
create table if not exists public.credit_card_payoffs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  total_amount numeric not null default 0,
  color        text,
  created_at   timestamptz not null default now()
);
create index if not exists credit_card_payoffs_user_idx on public.credit_card_payoffs (user_id, created_at);
alter table public.credit_card_payoffs enable row level security;
drop policy if exists "credit_card_payoffs_all_own" on public.credit_card_payoffs;
create policy "credit_card_payoffs_all_own" on public.credit_card_payoffs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- scheduled payments -----------------------------------------------------
create table if not exists public.credit_card_payments (
  id         uuid primary key default gen_random_uuid(),
  payoff_id  uuid not null references public.credit_card_payoffs (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  due_date   date not null,
  amount     numeric not null,
  paid       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists credit_card_payments_user_due_idx on public.credit_card_payments (user_id, due_date);
create index if not exists credit_card_payments_payoff_idx on public.credit_card_payments (payoff_id);
alter table public.credit_card_payments enable row level security;
drop policy if exists "credit_card_payments_all_own" on public.credit_card_payments;
create policy "credit_card_payments_all_own" on public.credit_card_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- realtime ---------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.credit_card_payoffs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.credit_card_payments; exception when duplicate_object then null; end;
end $$;
