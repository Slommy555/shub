# Session Spec — Schedule Mobile Fix, Budget Delete/Edit, Telegram Daily Brief

> Supersedes the previous PROMPT.md (Remove Capacitor/Electron/FCM → PWA + Web Push, now complete).
> Three things to fix/build, in order. Do not change anything not mentioned.
> Ask user for Telegram Bot Token + Chat ID before writing any Telegram code.

## PART 1 — SCHEDULE MOBILE FIX
**Issue A — work schedule events not showing on mobile.** Timeline/schedule view is blank on
mobile; work-schedule events visible on desktop don't appear. Definitive audit: log at top of
timeline component to confirm mount + events array on mobile; trace data flow (hook → prop →
filter) for where events get dropped; check CSS that hides content (height:0, display:none,
visibility:hidden, overflow:hidden at mobile widths); check for events positioned outside visible
scroll area (negative top / beyond container height). Fix root cause, remove debug logs. Confirm a
desktop-visible event appears at correct time on mobile.

**Issue B — timeline clipping (top + bottom hours cut off).** Earliest/latest hours clipped and
not scrollable. Ensure scroll container uses overflow-y:auto/scroll (not hidden), has defined
height accounting for mobile header/tab bar/toggle, and add padding-top/bottom so first/last hour
labels are fully readable. Verify at 375px all hours accessible by scrolling.

## PART 2 — BUDGET TRANSACTION DELETE + EDIT
**Delete.** Desktop: trash icon on right of each transaction row → confirm dialog "Delete this
transaction? This cannot be undone." → delete from budget_transactions, optimistic UI, update
totals/charts live. Mobile: swipe-left to reveal red Delete button (same pattern as other tabs) →
same confirm; keep trash icon as fallback.
**Edit.** Tap a row (not delete btn) → edit modal/sheet pre-filled (Amount, Type
Income/Expense/Savings, Category, Description, Date, Recurring toggle). Save changes → update
Supabase, reflect live. Cancel → close. Mobile = bottom sheet slides up.
Files: src/components/budget/TransactionCard.tsx, src/components/budget/EditTransactionModal.tsx
(new), src/hooks/budget/useBudgetTransactions.ts (add deleteTransaction, updateTransaction).

## PART 3 — TELEGRAM DAILY BRIEF
Edge Function on pg_cron every minute checks user's delivery time, collects day's data, sends to
Claude (claude-sonnet-4-6 via anthropic-proxy) to write brief, sends to Telegram. App need not be
open.

Schema (new migrations): user_preferences += telegram_enabled bool default false, telegram_time
time default '07:00', telegram_timezone text default 'America/Los_Angeles', telegram_sections jsonb
default all-true, workout_schedule jsonb nullable. notes += include_in_brief bool default false.
New table telegram_brief_log (id, user_id, sent_at, status, error_message, char_count, content) +
RLS own-rows-only.

UI: "Telegram Brief" section in Settings drawer (enable toggle, time picker, IANA timezone
dropdown auto-detected, section checkboxes, Save, Send test message). Notes: "Daily update"
checkbox per note (NoteEditor.tsx) → include_in_brief. Workout: "Weekly Workout Schedule" 7-row
planner (Rest / template names / custom) → workout_schedule.

Edge Function supabase/functions/telegram-brief/index.ts: service role key, fetch enabled users,
per user convert time+tz to UTC and match ±1min, skip if already sent today (telegram_brief_log),
collect sections (schedule/tasks/habits/workout/budget/notes), send to Claude, POST to Telegram
sendMessage (parse_mode Markdown, split >4096 chars w/ 500ms delay), log result. Errors per-user
non-fatal.

Migrations: 00X_telegram_settings.sql, 00X_telegram_cron.sql (pg_cron + pg_net; flag manual
activation in dashboard).

Secrets to set: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPABASE_SERVICE_ROLE_KEY.

## FINAL
npx supabase db push (skip already-applied on dup key). npm run build must pass.
git add . && commit "Schedule mobile fix, budget delete/edit, Telegram daily brief" && push.
Flag if pg_cron/pg_net need manual dashboard activation. Output SETUP CHECKLIST for Telegram.
