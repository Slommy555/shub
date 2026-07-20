-- ============================================================================
-- 034_multiple_budgets.sql — multiple independent budgets + savings pools.
--
-- * budgets            : a named, independent budget ("Personal", "Business").
--                        Each has its own periods, groups, amounts + savings.
-- * budget_id          : added to budget_periods + budget_groups so their rows
--                        belong to one budget (cascade on budget delete).
-- * budget_savings_pools    : a pool of set-aside money for one (budget, period).
-- * budget_savings_earmarks : how much of a pool is earmarked toward a group.
--
-- Data migration: any user with existing budget_periods/budget_groups gets a
-- default budget "My Budget" and all their existing rows are assigned to it.
-- Fully idempotent — safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- budgets ----------------------------------------------------------------
create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists budgets_user_pos_idx on public.budgets (user_id, position);
alter table public.budgets enable row level security;
drop policy if exists "budgets_all_own" on public.budgets;
create policy "budgets_all_own" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- budget_id on periods + groups ------------------------------------------
alter table public.budget_periods
  add column if not exists budget_id uuid references public.budgets (id) on delete cascade;
alter table public.budget_groups
  add column if not exists budget_id uuid references public.budgets (id) on delete cascade;

-- --- data migration: default budget for users with existing data ------------
do $$
declare
  u   record;
  bid uuid;
begin
  for u in
    select distinct user_id from (
      select user_id from public.budget_periods where budget_id is null
      union
      select user_id from public.budget_groups  where budget_id is null
    ) s
  loop
    -- reuse an existing budget for this user, else create "My Budget"
    select id into bid from public.budgets
      where user_id = u.user_id order by position, created_at limit 1;
    if bid is null then
      insert into public.budgets (user_id, name, position)
        values (u.user_id, 'My Budget', 0)
        returning id into bid;
    end if;
    update public.budget_periods set budget_id = bid where user_id = u.user_id and budget_id is null;
    update public.budget_groups  set budget_id = bid where user_id = u.user_id and budget_id is null;
  end loop;
end $$;

-- --- unique constraint now scoped per budget --------------------------------
-- previously unique (user_id, type, start_date); two budgets may each have the
-- same period, so include budget_id.
alter table public.budget_periods
  drop constraint if exists budget_periods_user_id_type_start_date_key;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'budget_periods_user_budget_type_start_key'
  ) then
    alter table public.budget_periods
      add constraint budget_periods_user_budget_type_start_key
      unique (user_id, budget_id, type, start_date);
  end if;
end $$;
create index if not exists budget_groups_budget_idx on public.budget_groups (budget_id, position);

-- --- savings pools (one per budget + period) --------------------------------
create table if not exists public.budget_savings_pools (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  budget_id   uuid not null references public.budgets (id) on delete cascade,
  period_id   uuid not null references public.budget_periods (id) on delete cascade,
  total_saved numeric not null default 0,
  created_at  timestamptz not null default now(),
  unique (budget_id, period_id)
);
create index if not exists budget_savings_pools_user_idx on public.budget_savings_pools (user_id);
alter table public.budget_savings_pools enable row level security;
drop policy if exists "budget_savings_pools_all_own" on public.budget_savings_pools;
create policy "budget_savings_pools_all_own" on public.budget_savings_pools
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- savings earmarks (pool → group) ----------------------------------------
create table if not exists public.budget_savings_earmarks (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references auth.users (id) on delete cascade,
  pool_id  uuid not null references public.budget_savings_pools (id) on delete cascade,
  group_id uuid not null references public.budget_groups (id) on delete cascade,
  amount   numeric not null default 0,
  unique (pool_id, group_id)
);
create index if not exists budget_savings_earmarks_pool_idx on public.budget_savings_earmarks (pool_id);
create index if not exists budget_savings_earmarks_user_idx on public.budget_savings_earmarks (user_id);
alter table public.budget_savings_earmarks enable row level security;
drop policy if exists "budget_savings_earmarks_all_own" on public.budget_savings_earmarks;
create policy "budget_savings_earmarks_all_own" on public.budget_savings_earmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- realtime ---------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.budgets; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budget_savings_pools; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budget_savings_earmarks; exception when duplicate_object then null; end;
end $$;
