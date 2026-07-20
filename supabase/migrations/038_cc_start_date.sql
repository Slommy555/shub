-- Credit-card payoff by date range instead of a week count.
--
-- A card now stores a start pay date and a due date; the payment per pay day =
-- balance ÷ (number of pay-day Thursdays from start through due), counted only in
-- that window (so it stops after the card is paid off). cc_weeks is left in place
-- but no longer used. Idempotent.

alter table public.budget_groups
  add column if not exists cc_start_date date;
