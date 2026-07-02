-- ============================================================================
-- 016_remove_reminders.sql — Drop the standalone Reminders feature
-- Run in the Supabase SQL Editor after 015, or via `supabase db push`.
--
-- The Reminders tab was replaced by Notes. This drops the `reminders` table
-- created in 010_reminders.sql. This table was used ONLY by the manually-set
-- reminders feature (src/hooks/useScheduledReminders.ts) — task due-date
-- notifications derive from the existing `tasks` table and are unaffected.
--
-- Safe/idempotent: `if exists` means re-running is a no-op. Removing it from the
-- realtime publication first avoids a dangling publication entry.
-- ============================================================================

do $$
begin
  begin
    alter publication supabase_realtime drop table public.reminders;
  exception when undefined_object then null;
  end;
end $$;

drop table if exists public.reminders;
