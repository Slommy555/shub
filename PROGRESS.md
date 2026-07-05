# Session Progress

## Part 1 — Schedule Mobile Fix
- [x] Audit why work schedule events are missing on mobile
      → ROOT CAUSE: work schedule (workDays/shifts/sleepHours) lived only in
      localStorage (useVoiceSettings), never in the DB. Timed *tasks* sync via
      Supabase (they showed); the work *shift* did not, so a phone signed into
      the same account had an empty schedule → blank timeline. Fixed by syncing
      work_schedule to user_preferences (migration 023 + useWorkScheduleSync,
      mounted in App). Same realtime pattern as useAppearance.
- [x] Fix timeline clipping (top and bottom hours cut off)
      → Added PAD_Y (14px) top/bottom in WeeklyView + ScheduleView so the first/
      last hour labels aren't clipped by the card's overflow-hidden rounded edge.
- [x] Fix events not rendering on mobile schedule view (same root cause as audit)
- [x] Verify events match desktop at 375px width (build passes; logic shared)

## Part 2 — Budget Transaction Delete
- [x] Add delete button to transaction list items (visible trash icon; desktop
      previously had NO way to delete — swipe was mobile-only)
- [x] Add swipe-to-delete on mobile (kept; now opens styled confirm, not window.confirm)
- [x] Add confirmation before deleting ("Delete this transaction? This cannot be
      undone." styled dialog w/ Cancel + Delete, shared by swipe + trash icon)
- [x] Add edit functionality for misinputs (new EditTransactionModal bottom
      sheet / centered modal; tap a row to open, all fields prefilled)
- [x] Verify deletion reflects immediately in totals/charts (optimistic state in
      useBudgetTransactions.deleteTransaction/updateTransaction; charts derive
      from api.transactions)

## Part 3 — Telegram Daily Brief
- [x] Telegram settings UI in app settings drawer
      (src/components/settings/TelegramBriefSettings.tsx + useTelegramPrefs, wired
      into SettingsView after NotificationSettings)
- [x] Notes include_in_brief checkbox ("Daily update" under note title in
      NoteEditor; column already existed from migration 020, wired updateNote)
- [x] Workout schedule day planner in workout settings
      (src/components/workout/WorkoutScheduleSettings.tsx, in the Templates sub-tab;
      writes user_preferences.workout_schedule — column existed from 020)
- [x] telegram-brief Edge Function (supabase/functions/telegram-brief/index.ts;
      collects schedule/tasks/habits/workout/budget/notes, calls Claude directly
      via ANTHROPIC_API_KEY — NOT the anthropic-proxy, which needs a per-user JWT
      a cron job can't supply — sends to Telegram w/ 4096 split, logs result)
- [x] pg_cron setup migration (025_telegram_cron.sql; pg_cron/pg_net already
      enabled from 021, reuses same GUCs)
- [x] telegram_brief_log table (migration 024, RLS select-own)
- [x] Supabase secrets configured (TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID set;
      ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY already present)
- [x] Test message sends successfully (direct Telegram API test delivered to the
      user's chat — ok:true; full AI pipeline runs via in-app "Send test" button)

## Final Steps
- [x] Supabase migrations pushed (023, 024, 025 applied to remote)
- [x] npm run build passing
- [x] Git pushed (commit 6e22ed7 + follow-up)
