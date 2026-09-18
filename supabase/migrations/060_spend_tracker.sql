-- ============================================================================
-- 060_spend_tracker.sql — the Spend tab's entries.
--
-- One row per thing you spent money on. `spent_at` is a calendar DATE (local
-- day, same convention as water_logs) so "today's total" is a plain equality
-- filter and a new day starts back at $0 with no reset step; `created_at` keeps
-- the wall-clock time the list shows next to each entry.
--
-- The optional daily limit is a client-side preference (localStorage), so
-- there's nothing for it here.
--
-- Idempotent — safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

create table if not exists public.spend_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  amount     numeric not null,
  label      text,
  spent_at   date not null default current_date,
  created_at timestamptz not null default now()
);

-- The list reads one window of days at a time, newest first.
create index if not exists spend_entries_user_id_spent_at_idx
  on public.spend_entries (user_id, spent_at desc, created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security — a user may only touch their own rows.
-- ----------------------------------------------------------------------------
alter table public.spend_entries enable row level security;

drop policy if exists "spend_entries_own" on public.spend_entries;
create policy "spend_entries_own" on public.spend_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- Realtime — the Spend tab and the Home card both subscribe, so an entry added
-- on one device shows up on the other without a refresh.
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.spend_entries;
  exception when duplicate_object then null;
  end;
end $$;
