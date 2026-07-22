-- ============================================================================
-- 045_fixed_expense_charge_day.sql — a recurring fixed-cost group can carry a
-- charge day (day of month it's billed), turning it into a per-month payoff
-- tracker just like a credit card.
--
-- budget_groups.due_day (1–31, null = no charge day → keep the flat even split).
-- budget_group_payments is the per-pay-day ledger of what you've set aside toward
-- a dated group, mirroring budget_card_payments. Remaining for a month = the
-- group's net monthly amount − what's been set aside on that month's earlier pay
-- days; suggested set-aside = remaining ÷ pay days left until the charge day.
-- Idempotent — safe to re-run.
-- ============================================================================

alter table public.budget_groups
  add column if not exists due_day integer;

create table if not exists public.budget_group_payments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  group_id   uuid not null references public.budget_groups (id) on delete cascade,
  pay_date   date not null,
  amount     numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (group_id, pay_date)
);

create index if not exists budget_group_payments_group_idx
  on public.budget_group_payments (group_id);

alter table public.budget_group_payments enable row level security;
drop policy if exists "budget_group_payments_all_own" on public.budget_group_payments;
create policy "budget_group_payments_all_own" on public.budget_group_payments
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_group_payments;
  exception when duplicate_object then null;
  end;
end $$;
