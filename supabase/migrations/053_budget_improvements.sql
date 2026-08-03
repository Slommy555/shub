-- ============================================================================
-- 053_budget_improvements.sql
--
-- Three additions to the Budget tab:
--
--   1. budget_groups.float_savings — a dated fixed cost can "float": the weekly
--      set-aside stays the flat even split, but the pay week containing the
--      charge day is MARKED in the Paycheck view. Display only; it never
--      changes an amount.
--
--   2. budget_group_overrides — a one-month override of a recurring cost's
--      monthly amount (car insurance is $180 most months, $210 in March)
--      without disturbing the default for every other month.
--
--   3. budget_periods.amount_set_aside — the manually-logged running total the
--      new Snapshot measures progress against ("I've set aside: $X").
--
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1. Float savings ------------------------------------------------------------
alter table public.budget_groups
  add column if not exists float_savings boolean not null default false;

-- 2. Per-month amount overrides ----------------------------------------------
create table if not exists public.budget_group_overrides (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  group_id        uuid not null references public.budget_groups (id) on delete cascade,
  budget_id       uuid not null references public.budgets (id) on delete cascade,
  -- Always the FIRST DAY of the month being overridden (e.g. 2026-03-01), so
  -- the unique constraint below is a true one-row-per-month guarantee.
  month           date not null,
  override_amount numeric not null,
  -- Optional reason ("Policy renewal").
  note            text,
  created_at      timestamptz not null default now(),
  unique (group_id, month)
);

create index if not exists budget_group_overrides_group_month_idx
  on public.budget_group_overrides (group_id, month);

alter table public.budget_group_overrides enable row level security;
drop policy if exists "budget_group_overrides_all_own" on public.budget_group_overrides;
create policy "budget_group_overrides_all_own" on public.budget_group_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_group_overrides;
  exception when duplicate_object then null;
  end;
end $$;

-- 3. Manually-logged set-aside running total ---------------------------------
alter table public.budget_periods
  add column if not exists amount_set_aside numeric not null default 0;
