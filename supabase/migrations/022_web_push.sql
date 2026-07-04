-- ============================================================================
-- 022_web_push.sql — migrate push storage from FCM tokens to Web Push (VAPID)
-- Drops the old FCM token column, adds a push_subscription column holding the
-- browser PushSubscription JSON, and adds char_count to notification_log.
-- Idempotent (safe to re-run). Requires user_preferences (012/020) and
-- notification_log (020).
-- ============================================================================

-- --- user_preferences: FCM token -> Web Push subscription ------------------
alter table public.user_preferences
  drop column if exists fcm_token;

alter table public.user_preferences
  add column if not exists push_subscription text;

-- --- notification_log: track brief length ----------------------------------
alter table public.notification_log
  add column if not exists char_count integer;
