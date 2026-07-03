# Session Spec — Mobile Fixes, Budget Tracker, Telegram Daily Brief

> Saved for session resumption. See PROGRESS.md for completion state.
> To resume: "Read PROMPT.md and PROGRESS.md from the project root and resume where you left off."

## SESSION MANAGEMENT
- PROMPT.md: this file (the full spec).
- PROGRESS.md: checklist of items; mark [x] and commit after each item completes.
- Before writing code, ask user for: (1) Telegram Bot Token, (2) Telegram Chat ID.
  These go into Supabase secrets (user runs `supabase secrets set ...`); not embedded in code.

Order: Part 1 (mobile fixes) → Part 2 (budget tracker) → Part 3 (telegram brief). Do not change anything not mentioned.

===========================
## PART 1 — MOBILE UI FIXES
===========================

FIX 1 — TOP BUTTONS HIDDEN BEHIND TASKS/SCHEDULE TOGGLE
The top header buttons (Work Days, Add Task, Sleep icon buttons) render behind/underneath the Tasks/Schedule toggle switcher on mobile, making them untappable.
- Audit z-index/stacking of the mobile header area.
- Ensure header buttons have higher z-index than the toggle, OR restructure so they don't overlap — header buttons in their own row ABOVE the toggle.
- Toggle sits below header buttons in DOM and visually, never on top.
- Verify all three icon buttons are tappable without the toggle intercepting touch.

FIX 2 — SCHEDULE TAB NOT SHOWING EVENTS ON MOBILE
Events that display on desktop still not appearing in mobile Schedule view (attempted before, do a deeper audit).
- Add temporary console.log to trace: full events/tasks array passed to timeline on mobile; whether timeline mounts on mobile; computed positions/heights of event elements.
- Check & fix whichever applies: (A) data not passed, (B) CSS hiding events (sm:hidden/md:hidden/media query), (C) zero height/width from container width calc, (D) overflow:hidden clipping, (E) component not mounting.
- Remove all console.log after fixing.
- Confirm: event added on desktop appears at correct time slot in mobile Schedule tab.

FIX 3 — MENU AND VOICE BUTTONS AS SIDE TABS ON MOBILE
Menu and voice buttons positioned too low on mobile, overlapping nav/content. Convert to small side tabs.
- Remove current floating positions for both menu toggle and voice mic on mobile.
- Two small vertical side tabs on RIGHT edge: each ~32px wide, 56px tall, anchored right.
  - Menu tab at 45% from top (hamburger icon); Voice tab at 55% from top (mic icon).
  - Semi-transparent/card bg, subtle shadow, protrude half-in/half-out from right edge.
  - Menu tab toggles sidebar drawer; Voice tab starts/stops recording.
  - Use env(safe-area-inset-right) for right positioning.
- Desktop layout of both buttons unchanged.

===========================
## PART 2 — BUDGET TRACKER TAB
===========================

### Supabase schema — migration 0XX_budget.sql
budget_categories(id uuid pk default gen_random_uuid(), user_id uuid → auth.users, name text not null, type text not null [income|expense|savings], color text, monthly_limit numeric null, position integer, created_at timestamptz default now())
budget_transactions(id, user_id → auth.users, category_id uuid → budget_categories(id) on delete set null, type text not null [income|expense|savings], amount numeric not null, description text, date date not null default current_date, recurring boolean default false, recurring_interval text null [daily|weekly|monthly|yearly], created_at)
savings_goals(id, user_id → auth.users, name text not null, target_amount numeric not null, current_amount numeric not null default 0, target_date date null, color text, created_at)
budget_settings(id, user_id → auth.users unique, monthly_income_target numeric null, currency_symbol text default '$', week_start text default 'monday', alert_threshold numeric default 0.8)
Enable RLS on all tables.
Seed budget_categories defaults — Income: Paycheck, Side Income, Other Income. Expenses: Housing, Food, Transport, Entertainment, Health, Shopping, Bills, Other. Savings: Emergency Fund, General Savings.
(Seed per-user; ideally on first load if none exist, since seeds need a user_id.)

### Tab structure — 4 sub-tabs: Overview / Transactions / Goals / Settings
OVERVIEW: summary strip (Total Income, Total Expenses, Net, Total Saved this month); budget alerts (amber >= alert_threshold% of limit, red when over, hidden when none); spending donut by expense category (Recharts); weekly trend bar (daily spend this week); monthly trend line (last 6 months, toggle income/expenses/net); recent transactions (last 5, tap → all).
TRANSACTIONS: add form (amount, type toggle, category dropdown, description, date, recurring toggle+interval); list grouped by date desc; filter bar (All/Income/Expenses/Savings + category filter + search); tap to edit inline, swipe-left mobile delete w/ confirm; month nav arrows.
GOALS: goal cards (name, color, progress bar current/target, target date, days remaining); "Add funds" per goal (input → savings transaction + updates current_amount); completed (current>=target) → collapsed "Completed" section; "New Goal" (name, target, date, color).
SETTINGS: categories list grouped by type (edit name/color/limit, drag reorder, delete w/ warning); budget limits (monthly_limit per expense category); alert threshold slider; preferences (income target, currency symbol, week start day).

### Claude voice integration — claudeActions.ts
Add log_transaction action to Claude system prompt:
  data: { type: income|expense|savings, amount: number, description: string, category_name: string|null, date: string|null, recurring: boolean }
  Examples: "I spent $45 on groceries"→expense,45,groceries,Food; "Got paid $2400"→income,2400,paycheck,Paycheck; "Put $200 into savings"→savings,200,savings transfer.
Add handleLogTransaction: review card (type badge, amount, description, category dropdown, date); "Log it" saves to budget_transactions; "Edit" allows changes first.

### File structure
src/components/budget/ — BudgetTab, OverviewTab, TransactionsTab, GoalsTab, BudgetSettingsTab, TransactionCard, GoalCard, BudgetAlertCard, SpendingChart, WeeklyTrendChart, MonthlyTrendChart, AddTransactionForm, TransactionReviewCard
src/hooks/budget/ — useBudgetTransactions, useBudgetCategories, useSavingsGoals, useBudgetSettings, useBudgetMetrics
src/types/budget.ts

===========================
## PART 3 — TELEGRAM DAILY BRIEF
===========================

Edge Function collects the day's data → Claude generates brief → sends via Telegram. pg_cron triggers each minute; sends at user's chosen time. No app needs to run.

### Supabase secrets (user runs)
supabase secrets set TELEGRAM_BOT_TOKEN=...
supabase secrets set TELEGRAM_CHAT_ID=...
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
(ANTHROPIC_API_KEY already set.)

### Telegram settings in app — "Telegram Brief" section in Settings drawer
Enable/disable toggle (default off); delivery time picker (hour+minute, local, default 7:00 AM); timezone selector (IANA strings, auto-detect from browser first open); section checkboxes (Schedule, Tasks, Habits, Workout day, Budget summary, Notes flagged, Time mgmt recommendations); Save button → user_preferences.
New migration columns on user_preferences:
  telegram_enabled boolean default false
  telegram_time time default '07:00'
  telegram_timezone text default 'America/Los_Angeles'
  telegram_sections jsonb default '{"schedule":true,"tasks":true,"habits":true,"workout":true,"budget":true,"notes":true,"recommendations":true}'

### Notes tab update
"Include in daily brief" checkbox per note ("Daily update", below title). Stores to include_in_brief boolean on notes (default false). New migration adds column.

### Workout schedule addition — "Workout Schedule" section in Workout tab settings
7 day slots (Mon–Sun) each dropdown: Rest / [template name] / Custom label. Store workout_schedule jsonb on user_preferences: {mon:"Push Day",...}. Brief reads this to tell workout day.

### Edge Function supabase/functions/telegram-brief/index.ts
1. Triggered by pg_cron each minute. 2. Fetch telegram settings; skip if telegram_enabled false. 3. Convert telegram_time+timezone to UTC, check ±1 min window. 4. Check telegram_brief_log; skip if already sent today. 5. Collect today's data (tasks due today/overdue not done; habits w/ today status; events today; workout: today DOW → workout_schedule → template name or "Rest Day"; budget: today's transactions, weekly spend vs pace, categories near/over limit; notes where include_in_brief=true title+snippet) — only enabled sections. 6. Send to Claude (claude-sonnet-4-6) with system prompt (concise friendly brief, adapt length, Telegram markdown *bold*/_italic_/• bullets, no # headers, recommendations only if enough, encouraging, motivational line). 7. POST to https://api.telegram.org/bot{TOKEN}/sendMessage {chat_id, text, parse_mode:"Markdown"}; split if >4096 chars. 8. Log to telegram_brief_log.
telegram_brief_log(id, user_id → auth.users, sent_at timestamptz default now(), status text [success|failed], error_message text null, char_count integer null)

### pg_cron setup migration
CREATE EXTENSION IF NOT EXISTS pg_cron; CREATE EXTENSION IF NOT EXISTS pg_net;
cron.schedule('telegram-brief-check','* * * * *', net.http_post to <supabase_url>/functions/v1/telegram-brief with auth bearer anon key, body '{}').
Note: pg_cron/pg_net may need manual activation in Supabase dashboard → Database → Extensions. FLAG clearly.

### Security
Use SUPABASE_SERVICE_ROLE_KEY server-side; never expose to frontend; only send to TELEGRAM_CHAT_ID from secrets.

### File additions
supabase/functions/telegram-brief/index.ts
supabase/migrations/0XX_telegram_settings.sql, 0XX_cron_setup.sql
src/components/settings/TelegramBriefSettings.tsx
src/components/notes/ (update NoteEditor.tsx — include_in_brief checkbox)
src/components/workout/WorkoutScheduleSettings.tsx

===========================
## MIGRATIONS / DEPLOY
===========================
npx supabase db push (if duplicate key: migration list, skip applied). Flag if pg_cron/pg_net need manual activation.
After build passes: git add . && git commit -m "Mobile fixes, budget tracker, and Telegram daily brief" && git push. Do not push if build fails.

## OUTPUT
Report each section ✓/✗ + summary. End with Telegram SETUP CHECKLIST (bot token, message bot, chat id, 3× secrets set, enable pg_cron/pg_net, deploy function, enable in app, test message).
