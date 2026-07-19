-- ============================================================================
-- 033_budget_persistence.sql — persistent vs non-persistent expenses + real
-- daily/weekly/monthly periods.
--
-- * budget_periods may now be type 'daily' (each navigable period holds its own
--   per-period income).
-- * budget_groups gains `persistent` (the toggle) and `amount` (the shared,
--   weekly-base value used when persistent — it repeats every period and scales
--   across timeframes). Non-persistent groups instead read a flat amount from
--   budget_allocations for the specific period being viewed.
--
-- Existing standalone allocation amounts are carried onto their group so the
-- expenses the user already entered become their persistent amounts. Idempotent.
-- ============================================================================

-- allow daily periods (keep weekly/monthly/standalone for existing rows)
alter table public.budget_periods drop constraint if exists budget_periods_type_check;
alter table public.budget_periods
  add constraint budget_periods_type_check
  check (type in ('daily', 'weekly', 'monthly', 'standalone'));

-- persistence toggle + shared (weekly-base) amount on the group
alter table public.budget_groups
  add column if not exists persistent boolean not null default true;
alter table public.budget_groups
  add column if not exists amount numeric not null default 0;

-- carry existing standalone allocation amounts onto the group as its persistent
-- amount (only where the group hasn't been given one yet)
update public.budget_groups g
set amount = a.amount
from public.budget_allocations a
join public.budget_periods p on p.id = a.period_id
where a.group_id = g.id
  and p.type = 'standalone'
  and g.amount = 0;
