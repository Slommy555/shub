# Session Spec — Capacitor Android, Electron PC, Firebase Push

> Supersedes the previous PROMPT.md (Budget/Telegram). Firebase push here
> **replaces** the planned Telegram daily brief. Note: the prior task's "Budget
> voice integration (log_transaction)" was left unfinished and is NOT part of
> this spec. Budget Tracker UI itself is done (commit 8e204b5).
> Resume with: "Read PROMPT.md and PROGRESS.md and resume where you left off."

App is React + Vite + Supabase. Web version must keep working alongside native apps. All three share the same Supabase backend. appId `com.personal.productivityapp`, appName **Slommy HQ**.

===========================
## PART 1 — CAPACITOR ANDROID APP
===========================
Wrap the Vite web app in a native Android shell → sideloadable APK for a Galaxy S26 Ultra (no Play Store).

Install: `@capacitor/core @capacitor/cli @capacitor/android`; `npx cap init`; `npx cap add android`.
capacitor.config.ts at root: appId `com.personal.productivityapp`, appName `Slommy HQ`, webDir `dist`, server.androidScheme `https`, plugins.PushNotifications.presentationOptions `['badge','sound','alert']`.

Native plugins (guard ALL usage with `Capacitor.isNativePlatform()` or dynamic import so web build never breaks):
1. `@capacitor/camera` — barcode scanner: BarcodeScanner.tsx uses native camera on native, falls back to `@zxing/browser` on web.
2. `@capacitor/filesystem` — local file ops.
3. `@capacitor/app` — foreground/background; refetch on resume (mirror existing visibilitychange listener).
4. `@capacitor/status-bar` — set color to theme; update on dark/light change; Android safe-area insets.
5. `@capacitor/splash-screen` — splash using primary color.
6. `@capacitor/haptics` — light haptic on task-complete checkbox, habit completion, workout set completion.

AndroidManifest.xml permissions: INTERNET, CAMERA, RECEIVE_BOOT_COMPLETED, VIBRATE, POST_NOTIFICATIONS; uses-feature camera required=false.

package.json scripts:
`"android:build": "npm run build && npx cap sync android && cd android && ./gradlew assembleDebug"`
`"android:open": "npx cap open android"`
APK output: android/app/build/outputs/apk/debug/app-debug.apk. Note transfer/sideload steps.

When native: remove PWA add-to-home prompt if any; apply status-bar safe insets. Existing <640px responsive layout applies automatically.

===========================
## PART 2 — ELECTRON PC APP
===========================
Wrap the web app in a desktop window → Windows .exe.

Install (dev): `electron electron-builder concurrently wait-on cross-env`.
electron/main.js: BrowserWindow 1280x800 (min 900x600), preload, titleBarStyle hiddenInset, icon public/icons/icon-512.png; dev loads http://localhost:5173 + devtools, prod loads dist/index.html; system Tray (icon-192) with click→show; native menu bar (App/Edit/View roles + Quit CmdOrCtrl+Q); setWindowOpenHandler → shell.openExternal external links; standard window-all-closed/activate handlers.
electron/preload.js: empty (DOMContentLoaded stub).

package.json: `"main": "electron/main.js"`; scripts electron:dev (concurrently dev + wait-on + cross-env NODE_ENV=development electron .), electron:build (build + electron-builder --win), electron:build:dir. build config: appId com.personal.productivityapp, productName "Slommy HQ", directories.output dist-electron, files [dist/**, electron/**, public/icons/**], win.target nsis + icon, nsis oneClick + desktop/startmenu shortcuts.
Detect Electron via userAgent contains 'Electron'; hide PWA prompt; desktop layout auto (1280 wide).

⚠ NOTE: main "electron/main.js" + "type" field can conflict with Vite. Keep electron main as CommonJS .cjs or ensure package.json has no "type":"module". Verify web build/dev still work after adding "main".

===========================
## PART 3 — PUSH NOTIFICATIONS (replaces Telegram)
===========================
FCM push on Android (Capacitor) + web. Supabase Edge Function + pg_cron sends at user's chosen time.

Firebase (USER does): create project; add Android app pkg com.personal.productivityapp; download google-services.json → android/app/; get FCM Server Key → `supabase secrets set FCM_SERVER_KEY=...`.

Capacitor push: `@capacitor/push-notifications`; android/app/build.gradle `apply plugin 'com.google.gms.google-services'`; android/build.gradle classpath `com.google.gms:google-services:4.3.15`.

src/lib/pushNotifications.ts: registerPushNotifications() — native only; request perms; register; on 'registration' upsert fcm_token to user_preferences for the user; on received (foreground) in-app toast; on actionPerformed navigate to data.tab. Call after login.

Edge Functions:
- send-push/index.ts: POST {user_id,title,body,data?}; look up fcm_token (service role); skip if none; POST fcm.googleapis.com/fcm/send with Authorization key=FCM_SERVER_KEY, {to, notification:{title,body,icon:'ic_notification'}, data}.
- daily-brief-push/index.ts: pg_cron each minute; check notification_enabled/time/timezone (±1min) + notification_log not sent today; collect today's tasks/habits/schedule/workout-day/budget/flagged-notes (enabled sections); Claude (claude-sonnet-4-6) plain-text brief; call send-push title "Good morning! Here's your daily brief", body first 100 chars + "…", data {tab:'home', fullBrief}; log to notification_log (with content).
- task-reminders/index.ts: pg_cron; tasks due today (8AM) / 1hr before if timed; send-push "Task due today: [name]", data tab tasks.
- habit-reminders/index.ts: pg_cron; habits whose reminder_time matches now; send-push "Habit reminder: [name]".

In-app: NotificationSettings.tsx in Settings drawer — master toggle, daily brief toggle+time+timezone, section checkboxes (schedule/tasks/habits/workout/budget/notes), task reminders toggle, habit reminders note, Test notification button (sends test push now). DailyBriefModal.tsx — full brief view opened on notification tap; bell icon in top nav shows most recent brief; store last 7 briefs in notification_log.content.

Per-habit reminder_time in Focus/Habits settings.

===========================
## SCHEMA (migrations)
===========================
00X_notifications.sql: user_preferences += fcm_token text, notification_enabled bool default false, notification_time time default '07:00', notification_timezone text default 'America/Los_Angeles', notification_sections jsonb default '{"schedule":true,"tasks":true,"habits":true,"workout":true,"budget":true,"notes":true}', task_reminders_enabled bool default true. notification_log(id, user_id, sent_at, type [daily_brief|task_reminder|habit_reminder], status, error_message, content text). habits += reminder_time time null. notes += include_in_brief bool default false (if not present). Also user_preferences needs workout_schedule jsonb (from prior plan) if referenced.
00X_cron_push.sql: CREATE EXTENSION pg_cron, pg_net; cron.schedule daily-brief-push, task-reminders, habit-reminders (every minute → net.http_post to each function). Flag pg_cron/pg_net manual activation.

===========================
## FILES
===========================
capacitor.config.ts; electron/{main.js,preload.js}; android/ (generated); src/lib/pushNotifications.ts; src/components/settings/NotificationSettings.tsx; src/components/DailyBriefModal.tsx; supabase/functions/{send-push,daily-brief-push,task-reminders,habit-reminders}/index.ts; supabase/migrations/{00X_notifications.sql,00X_cron_push.sql}.

## DEPLOY
`npx supabase db push` (dup key → migration list, skip applied; flag pg_cron/pg_net). After `npm run build` passes: git add/commit "Capacitor Android, Electron PC, and push notifications" / push.

## SETUP CHECKLIST (emit at end)
Firebase (create project, add android app, google-services.json → android/app/, FCM key secret, service role secret); Android APK (npm run android:build → APK path → transfer/sideload); PC app (npm run electron:build → dist-electron/ .exe); Notifications (enable pg_cron/pg_net, deploy 4 functions, enable in Settings, Test notification).

## ENVIRONMENT REALITY (this dev box)
Windows, no Android SDK/emulator, no GUI verification. APK gradle build + Electron .exe build + FCM require the user's machine/credentials. Claude scaffolds all code/config/migrations/functions and web build stays green; native BUILD + VERIFY steps are the user's to run (documented in checklist).
