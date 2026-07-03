-- ============================================================================
-- 019_budget.sql — Budget Tracker schema
-- budget_categories, budget_transactions, savings_goals, budget_settings.
-- RLS: each user only sees/edits their own rows. Realtime enabled so the UI
-- stays in sync across devices. Default categories are seeded per-user on first
-- load by the useBudgetCategories hook (seeds need a user_id, so they can't live
-- in this migration).
-- ============================================================================

create extension if not exists "pgcrypto";

-- --- categories -------------------------------------------------------------
create table if not exists public.budget_categories (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  type          text not null default 'expense' check (type in ('income', 'expense', 'savings')),
  color         text,
  monthly_limit numeric,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists budget_categories_user_idx on public.budget_categories (user_id, position);
alter table public.budget_categories enable row level security;
drop policy if exists "budget_categories_all_own" on public.budget_categories;
create policy "budget_categories_all_own" on public.budget_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- transactions -----------------------------------------------------------
create table if not exists public.budget_transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  category_id        uuid references public.budget_categories (id) on delete set null,
  type               text not null default 'expense' check (type in ('income', 'expense', 'savings')),
  amount             numeric not null,
  description        text,
  date               date not null default current_date,
  recurring          boolean not null default false,
  recurring_interval text check (recurring_interval in ('daily', 'weekly', 'monthly', 'yearly')),
  created_at         timestamptz not null default now()
);
create index if not exists budget_transactions_user_date_idx on public.budget_transactions (user_id, date desc);
alter table public.budget_transactions enable row level security;
drop policy if exists "budget_transactions_all_own" on public.budget_transactions;
create policy "budget_transactions_all_own" on public.budget_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- savings goals ----------------------------------------------------------
create table if not exists public.savings_goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  target_amount  numeric not null,
  current_amount numeric not null default 0,
  target_date    date,
  color          text,
  created_at     timestamptz not null default now()
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id, created_at);
alter table public.savings_goals enable row level security;
drop policy if exists "savings_goals_all_own" on public.savings_goals;
create policy "savings_goals_all_own" on public.savings_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- settings (one row per user) --------------------------------------------
create table if not exists public.budget_settings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users (id) on delete cascade,
  monthly_income_target numeric,
  currency_symbol       text not null default '$',
  week_start            text not null default 'monday',
  alert_threshold       numeric not null default 0.8
);
alter table public.budget_settings enable row level security;
drop policy if exists "budget_settings_all_own" on public.budget_settings;
create policy "budget_settings_all_own" on public.budget_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- --- realtime ---------------------------------------------------------------
do $$
begin
  begin alter publication supabase_realtime add table public.budget_categories; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budget_transactions; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.savings_goals; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.budget_settings; exception when duplicate_object then null; end;
end $$;
