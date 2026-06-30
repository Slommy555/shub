-- ============================================================================
-- 011_macros.sql — Macro Tracker feature (self-contained)
-- Run this in the Supabase SQL Editor after 001–010, or via `supabase db push`.
--
-- (Spec called this 003_macros.sql, but 003–010 already exist in this project;
--  numbered 011 so it applies cleanly on top of the existing schema.)
--
-- Four tables, all with Row Level Security: a user may only read/write rows
-- where user_id = auth.uid().
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- meal_categories — user-defined meals (Breakfast, Lunch, …), orderable
-- ----------------------------------------------------------------------------
create table if not exists public.meal_categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- food_log_entries — one logged food on a given day
-- ----------------------------------------------------------------------------
create table if not exists public.food_log_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  meal_category_id uuid references public.meal_categories (id) on delete set null,
  logged_at        date not null default current_date,
  food_name        text not null,
  brand            text,
  serving_size     numeric not null,
  serving_unit     text not null,
  calories         numeric not null,
  protein_g        numeric not null,
  carbs_g          numeric not null,
  fat_g            numeric not null,
  usda_fdc_id      text,
  barcode          text,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- macro_targets — one row per user (daily goals)
-- ----------------------------------------------------------------------------
create table if not exists public.macro_targets (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  calories   numeric not null default 2000,
  protein_g  numeric not null default 150,
  carbs_g    numeric not null default 200,
  fat_g      numeric not null default 65,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- saved_foods — frequently used foods for quick re-logging
-- ----------------------------------------------------------------------------
create table if not exists public.saved_foods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  food_name    text not null,
  brand        text,
  serving_size numeric not null,
  serving_unit text not null,
  calories     numeric not null,
  protein_g    numeric not null,
  carbs_g      numeric not null,
  fat_g        numeric not null,
  usda_fdc_id  text,
  barcode      text,
  times_logged integer not null default 1,
  last_logged  timestamptz not null default now()
);

-- Indexes for the app's access patterns.
create index if not exists meal_categories_user_position_idx
  on public.meal_categories (user_id, position);
create index if not exists food_log_entries_user_date_idx
  on public.food_log_entries (user_id, logged_at);
create index if not exists saved_foods_user_times_idx
  on public.saved_foods (user_id, times_logged desc);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.meal_categories  enable row level security;
alter table public.food_log_entries enable row level security;
alter table public.macro_targets    enable row level security;
alter table public.saved_foods      enable row level security;

-- A single owner policy per action, applied to every table below.
do $$
declare
  t text;
begin
  foreach t in array array[
    'meal_categories', 'food_log_entries', 'macro_targets', 'saved_foods'
  ]
  loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_select_own" on public.%1$s for select using (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_insert_own" on public.%1$s for insert with check (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_update_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_update_own" on public.%1$s for update using (auth.uid() = user_id) with check (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_delete_own" on public.%1$s for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Realtime — let the client subscribe to row changes on these tables.
-- ----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'meal_categories', 'food_log_entries', 'macro_targets', 'saved_foods'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%s;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
