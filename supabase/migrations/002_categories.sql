-- ============================================================================
-- 002_categories.sql — User-defined categories
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to run once; uses IF [NOT] EXISTS guards throughout.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Free the tasks.category column from the old fixed-value CHECK so it can
--    hold any user-defined category name.
-- ----------------------------------------------------------------------------
alter table public.tasks drop constraint if exists tasks_category_check;

-- ----------------------------------------------------------------------------
-- 2. categories table
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  color      text not null default 'gray',
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_id_position_idx
  on public.categories (user_id, position);

-- ----------------------------------------------------------------------------
-- 3. Row Level Security — a user may only touch their own categories.
-- ----------------------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists "categories_select_own" on public.categories;
create policy "categories_select_own" on public.categories
  for select using (auth.uid() = user_id);

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. Realtime
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.categories;
  exception when duplicate_object then null;
  end;
end $$;
