-- ============================================================================
-- 030_budget_rebuild.sql — rebuilt Budget tab (weekly + monthly)
-- Run via `supabase db push` or the Supabase SQL Editor (after 029).
--
-- budget_periods      : one row per user per period type (weekly|monthly) per
--                       start_date. Holds the income for that period.
-- budget_groups       : expense groups (Rent, Food, ...). SHARED across the
--                       weekly and monthly views — only allocations are
--                       per-period. `position` drives drag-to-reorder.
-- budget_allocations  : per-period budgeted + spent amount for a group. Unique
--                       on (period_id, group_id). Cascades on period/group delete.
-- RLS: each user only sees/edits their own rows. Realtime enabled so income and
-- spend edits sync across devices. Idempotent — safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- periods ----------------------------------------------------------------
create table if not exists public.budget_periods (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  type       text not null check (type in ('weekly', 'monthly')),
  label      text not null,
  start_date date not null,
  end_date   date not null,
  income     numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, type, start_date)
);
create index if not exists budget_periods_user_type_idx
  on public.budget_periods (user_id, type, start_date);
alter table public.budget_periods enable row level security;
drop policy if exists "budget_periods_all_own" on public.budget_periods;
create policy "budget_periods_all_own" on public.budget_periods
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- groups (shared across weekly + monthly) --------------------------------
create table if not exists public.budget_groups (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists budget_groups_user_pos_idx
  on public.budget_groups (user_id, position);
alter table public.budget_groups enable row level security;
drop policy if exists "budget_groups_all_own" on public.budget_groups;
create policy "budget_groups_all_own" on public.budget_groups
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- allocations (per period, per group) ------------------------------------
create table if not exists public.budget_allocations (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  period_id uuid not null references public.budget_periods (id) on delete cascade,
  group_id  uuid not null references public.budget_groups (id) on delete cascade,
  budgeted  numeric not null default 0,
  spent     numeric not null default 0,
  unique (period_id, group_id)
);
create index if not exists budget_allocations_period_idx
  on public.budget_allocations (period_id);
create index if not exists budget_allocations_user_idx
  on public.budget_allocations (user_id);
alter table public.budget_allocations enable row level security;
drop policy if exists "budget_allocations_all_own" on public.budget_allocations;
create policy "budget_allocations_all_own" on public.budget_allocations
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- realtime ---------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.budget_periods; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budget_groups; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budget_allocations; exception when duplicate_object then null; end;
end $$;
