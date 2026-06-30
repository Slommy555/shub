-- ============================================================================
-- 014_user_preferences_custom_colors.sql — add custom color theming to sync
-- Run via `supabase db push` or the Supabase SQL Editor (after 012).
--
-- Adds a `custom_colors` jsonb column to user_preferences so the user's custom
-- palette (Settings → Appearance) syncs across devices alongside `theme`. Shape:
--   { "enabled": boolean, "colors": { bg, surface, text, muted, border, accent,
--     accentText } }  (all hex strings). NULL means "never customized".
-- RLS + the realtime publication membership were already set up in 012.
-- ============================================================================

alter table public.user_preferences
  add column if not exists custom_colors jsonb;
