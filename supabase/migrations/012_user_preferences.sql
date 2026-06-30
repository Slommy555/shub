-- ============================================================================
-- 012_user_preferences.sql — Per-user app preferences (theme, synced devices)
-- Run this in the Supabase SQL Editor after 001–011, or via `supabase db push`.
--
-- One row per user. `theme` is the dark/light preference, synced across every
-- device the user is signed in on; see src/hooks/useTheme.ts. The table is added
-- to the realtime publication so a change on one device updates others live.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.user_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references auth.users (id) on delete cascade,
  theme      text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists "user_preferences_select_own" on public.user_preferences;
create policy "user_preferences_select_own" on public.user_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "user_preferences_insert_own" on public.user_preferences;
create policy "user_preferences_insert_own" on public.user_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_preferences_update_own" on public.user_preferences;
create policy "user_preferences_update_own" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "user_preferences_delete_own" on public.user_preferences;
create policy "user_preferences_delete_own" on public.user_preferences
  for delete using (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.user_preferences;
  exception when duplicate_object then null;
  end;
end $$;
