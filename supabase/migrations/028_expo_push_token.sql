-- ============================================================================
-- 028_expo_push_token.sql — store the iOS (Expo) push token per user
--
-- The new Expo app (apple/) registers for notifications and saves its Expo push
-- token here so future habit reminders / daily briefs can reach the phone. This
-- is parallel to the existing web push_subscription column (migration 022).
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.user_preferences
  add column if not exists expo_push_token text;
