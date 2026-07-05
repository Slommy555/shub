-- ============================================================================
-- 026_budget_weekly_limits.sql — weekly spending limit + savings goal
-- Run via `supabase db push` or the Supabase SQL Editor (after 019).
--
-- Adds two nullable numeric columns to budget_settings so the user can set an
-- overall weekly spending cap and a weekly savings goal. Progress against them
-- is shown on the Budget Overview tab. Both are amounts in the user's currency;
-- NULL means "not set" (no cap / no goal). RLS + realtime already configured for
-- budget_settings in 019.
-- ============================================================================

alter table public.budget_settings
  add column if not exists weekly_spending_limit numeric,
  add column if not exists weekly_savings_target numeric;
