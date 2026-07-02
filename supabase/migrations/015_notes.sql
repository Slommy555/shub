-- ============================================================================
-- 015_notes.sql — Notes feature (pages + rich-text notes)
-- Run in the Supabase SQL Editor after 001–014, or via `supabase db push`.
--
-- Replaces the old Reminders tab. `note_pages` are user-created folders; `notes`
-- belong to a page and store Tiptap/ProseMirror JSON in `content`. Both tables
-- are per-user with RLS, and are added to the realtime publication so edits
-- sync across a user's devices. See src/hooks/notes/*.
-- ============================================================================

create extension if not exists "pgcrypto";

-- Pages (folders) -----------------------------------------------------------
create table if not exists public.note_pages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  title      text not null,
  icon       text,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists note_pages_user_position_idx
  on public.note_pages (user_id, position);

alter table public.note_pages enable row level security;

drop policy if exists "note_pages_select_own" on public.note_pages;
create policy "note_pages_select_own" on public.note_pages
  for select using (auth.uid() = user_id);

drop policy if exists "note_pages_insert_own" on public.note_pages;
create policy "note_pages_insert_own" on public.note_pages
  for insert with check (auth.uid() = user_id);

drop policy if exists "note_pages_update_own" on public.note_pages;
create policy "note_pages_update_own" on public.note_pages
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "note_pages_delete_own" on public.note_pages;
create policy "note_pages_delete_own" on public.note_pages
  for delete using (auth.uid() = user_id);

-- Notes ---------------------------------------------------------------------
create table if not exists public.notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  page_id    uuid not null references public.note_pages (id) on delete cascade,
  title      text not null default 'Untitled',
  content    jsonb not null default '{}'::jsonb,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notes_user_page_position_idx
  on public.notes (user_id, page_id, position);

alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.note_pages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.notes;
  exception when duplicate_object then null;
  end;
end $$;
