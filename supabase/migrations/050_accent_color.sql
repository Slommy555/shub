-- ============================================================================
-- 050_accent_color.sql — user-chosen accent color
--
-- One base hex (e.g. '#3b82f6'); the client derives the full 50–900 ramp from
-- it and writes it into CSS variables. NULL keeps the built-in lavender.
-- Idempotent.
-- ============================================================================

alter table public.user_preferences
  add column if not exists accent_color text;
