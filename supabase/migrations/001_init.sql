-- ============================================================================
-- 001_init.sql — Tasks & subtasks schema with Row Level Security
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- or via the Supabase CLI: `supabase db push`.
-- ============================================================================

-- gen_random_uuid() lives in pgcrypto. It's preinstalled on Supabase, but this
-- keeps the migration self-contained if you run it elsewhere.
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- tasks
-- ----------------------------------------------------------------------------
create table if not exists public.tasks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  text       text not null,
  notes      text,
  category   text not null default 'other'
             check (category in ('work', 'personal', 'school', 'health', 'other')),
  priority   text not null default 'med'
             check (priority in ('high', 'med', 'low')),
  done       boolean not null default false,
  due_date   date,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- subtasks
-- ----------------------------------------------------------------------------
create table if not exists public.subtasks (
  id       uuid primary key default gen_random_uuid(),
  task_id  uuid not null references public.tasks (id) on delete cascade,
  text     text not null,
  done     boolean not null default false,
  position integer not null default 0
);

-- Helpful indexes for the access patterns the app uses.
create index if not exists tasks_user_id_position_idx
  on public.tasks (user_id, position);
create index if not exists subtasks_task_id_position_idx
  on public.subtasks (task_id, position);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.tasks    enable row level security;
alter table public.subtasks enable row level security;

-- tasks: a user may only touch their own rows.
drop policy if exists "tasks_select_own" on public.tasks;
create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

drop policy if exists "tasks_insert_own" on public.tasks;
create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);

drop policy if exists "tasks_update_own" on public.tasks;
create policy "tasks_update_own" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "tasks_delete_own" on public.tasks;
create policy "tasks_delete_own" on public.tasks
  for delete using (auth.uid() = user_id);

-- subtasks: ownership is derived from the parent task's user_id.
drop policy if exists "subtasks_select_own" on public.subtasks;
create policy "subtasks_select_own" on public.subtasks
  for select using (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "subtasks_insert_own" on public.subtasks;
create policy "subtasks_insert_own" on public.subtasks
  for insert with check (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "subtasks_update_own" on public.subtasks;
create policy "subtasks_update_own" on public.subtasks
  for update using (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "subtasks_delete_own" on public.subtasks;
create policy "subtasks_delete_own" on public.subtasks
  for delete using (
    exists (
      select 1 from public.tasks t
      where t.id = subtasks.task_id and t.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Realtime — let the client subscribe to row changes on both tables.
-- (Wrapped so re-running the migration doesn't error if already added.)
-- ----------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.tasks;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.subtasks;
  exception when duplicate_object then null;
  end;
end $$;
