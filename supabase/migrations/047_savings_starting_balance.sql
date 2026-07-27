-- ============================================================================
-- 047_savings_starting_balance.sql — a starting balance for the standalone
-- Savings tab, so the running balance builds on money you already had saved.
--
-- One row per user. Current balance = starting_balance + Σ(in) − Σ(out) from
-- savings_ledger. Idempotent — safe to re-run.
-- ============================================================================

create table if not exists public.savings_settings (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  starting_balance numeric not null default 0,
  updated_at       timestamptz not null default now()
);

alter table public.savings_settings enable row level security;
drop policy if exists "savings_settings_all_own" on public.savings_settings;
create policy "savings_settings_all_own" on public.savings_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.savings_settings;
  exception when duplicate_object then null;
  end;
end $$;
