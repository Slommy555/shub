-- Lift: template folders + body logs (weight / calories).
-- Written idempotently so re-running is safe.

create table if not exists public.lift_template_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.lift_workout_templates
  add column if not exists folder_id uuid references public.lift_template_folders(id) on delete set null;

create table if not exists public.lift_body_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  type text not null check (type in ('weight', 'calories')),
  value numeric not null,
  logged_at date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, type, logged_at)
);

create index if not exists lift_template_folders_user_idx on public.lift_template_folders(user_id, position);
create index if not exists lift_body_logs_user_idx on public.lift_body_logs(user_id, type, logged_at desc);

alter table public.lift_template_folders enable row level security;
alter table public.lift_body_logs enable row level security;

drop policy if exists "lift own" on public.lift_template_folders;
create policy "lift own" on public.lift_template_folders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "lift own" on public.lift_body_logs;
create policy "lift own" on public.lift_body_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
