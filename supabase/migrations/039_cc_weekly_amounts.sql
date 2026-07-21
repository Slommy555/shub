-- ============================================================================
-- 039_cc_weekly_amounts.sql — per-period credit-card payment overrides.
--
-- Credit cards are budget_groups with kind='credit_card'. By default a card's
-- per-pay-date payment is DERIVED from its balance + payoff window
-- (start pay date → due date). This table lets you override that payment for a
-- specific month: when a row exists for (card, period), its weekly_payment
-- replaces the derived amount for that month only — fully isolated per period,
-- like an expense-group allocation. No row = fall back to the derived payoff
-- payment. The payoff model on budget_groups is left intact.
--
-- NOTE: the original spec referenced a `budget_credit_cards` table, but cards
-- have always lived in `budget_groups` (kind='credit_card'), so card_id points
-- there. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.budget_credit_card_payments (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  card_id        uuid not null references public.budget_groups (id) on delete cascade,
  period_id      uuid not null references public.budget_periods (id) on delete cascade,
  weekly_payment numeric not null default 0,
  created_at     timestamptz not null default now(),
  unique (card_id, period_id)
);

create index if not exists budget_credit_card_payments_card_period_idx
  on public.budget_credit_card_payments (card_id, period_id);

alter table public.budget_credit_card_payments enable row level security;
drop policy if exists "budget_credit_card_payments_all_own" on public.budget_credit_card_payments;
create policy "budget_credit_card_payments_all_own" on public.budget_credit_card_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_credit_card_payments;
  exception when duplicate_object then null;
  end;
end $$;
