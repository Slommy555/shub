-- ============================================================================
-- 046_savings_ledger.sql — a simple standalone savings tracker (its own top-level
-- tab, independent of the Budget tab's savings accounting).
--
-- Each row is one dated movement of money: kind 'in' = money put away (deposit),
-- kind 'out' = money taken out (a payment). The running balance = Σ in − Σ out.
-- Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.savings_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  entry_date date not null,
  kind       text not null check (kind in ('in', 'out')),
  amount     numeric not null default 0,
  note       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists savings_ledger_user_date_idx
  on public.savings_ledger (user_id, entry_date);

alter table public.savings_ledger enable row level security;
drop policy if exists "savings_ledger_all_own" on public.savings_ledger;
create policy "savings_ledger_all_own" on public.savings_ledger
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.savings_ledger;
  exception when duplicate_object then null;
  end;
end $$;
