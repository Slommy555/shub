-- ============================================================================
-- 052_nutrition_scanner.sql — Nutrition label scanner tab.
--
-- nutrition_logs:  one row per food the user logged, already resolved to the
--                  macros for the amount THEY ate (the Claude vision call does
--                  the serving-size math before we ever store anything). Images
--                  are ephemeral and never stored.
-- nutrition_goals: one row per user (unique) holding their daily targets; the
--                  daily total strip renders progress bars when it exists.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.nutrition_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  food_name    text,
  calories     numeric not null default 0,
  protein_g    numeric not null default 0,
  carbs_g      numeric not null default 0,
  fat_g        numeric not null default 0,
  serving_size text,
  logged_at    date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists nutrition_logs_user_day_idx
  on public.nutrition_logs (user_id, logged_at);

alter table public.nutrition_logs enable row level security;
drop policy if exists "nutrition_logs_all_own" on public.nutrition_logs;
create policy "nutrition_logs_all_own" on public.nutrition_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.nutrition_goals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  calories   numeric default 2000,
  protein_g  numeric default 150,
  carbs_g    numeric default 200,
  fat_g      numeric default 65,
  created_at timestamptz not null default now()
);

alter table public.nutrition_goals enable row level security;
drop policy if exists "nutrition_goals_all_own" on public.nutrition_goals;
create policy "nutrition_goals_all_own" on public.nutrition_goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.nutrition_logs;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.nutrition_goals;
  exception when duplicate_object then null;
  end;
end $$;
