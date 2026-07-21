-- ============================================================================
-- 043_card_charges.sql — a transaction log of what has been charged to a card.
--
-- Each time an amount is charged to a card (e.g. a scheduled expense moved onto
-- it) a row is recorded here with its name + amount, so the card shows a running
-- list of its charges. Deleting a charge (in the app) also backs its amount out
-- of the card balance. Idempotent.
-- ============================================================================

create table if not exists public.budget_card_charges (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  card_id    uuid not null references public.budget_credit_cards (id) on delete cascade,
  name       text not null,
  amount     numeric not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists budget_card_charges_card_idx
  on public.budget_card_charges (card_id, created_at desc);

alter table public.budget_card_charges enable row level security;
drop policy if exists "budget_card_charges_all_own" on public.budget_card_charges;
create policy "budget_card_charges_all_own" on public.budget_card_charges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

do $$
begin
  begin
    alter publication supabase_realtime add table public.budget_card_charges;
  exception when duplicate_object then null;
  end;
end $$;
