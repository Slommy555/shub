# Session Progress

## Part 1 — Capacitor Android Setup
- [x] Install and configure Capacitor
- [x] Android platform added
- [x] Capacitor config and permissions
- [x] Native camera plugin (barcode scanner) — plugin installed; NO barcode
      scanner exists in the app (removed with the old macro tracker), so nothing
      to convert. Camera plugin ready for future use.
- [x] Native filesystem access (plugin installed)
- [ ] Build APK and verify it installs — needs Android SDK/Gradle on user machine
      (run `npm run android:build`; not buildable in this dev env)

## Part 2 — Electron PC App
- [x] Install and configure Electron
- [x] Electron main process setup (electron/main.cjs, preload.cjs; .cjs because
      package is ESM). Vite base conditional on ELECTRON env so web is unchanged.
- [x] Native menu bar (App/Edit/View)
- [x] Auto-updater config (electron-updater, no-op until a publish feed is set)
- [ ] Build .exe installer — run `npm run electron:build` on Windows (downloads
      NSIS/electron binaries; not run here)
- [ ] Verify app opens correctly — needs a desktop GUI (run electron:dev locally)

## Part 3 — Push Notifications
- [x] Firebase Cloud Messaging setup — CODE ready (Capacitor push plugin +
      conditional google-services in app/build.gradle). USER must create the
      Firebase project, add google-services.json to android/app/, and set
      FCM_SERVER_KEY secret (see checklist).
- [x] Capacitor push notification plugin (installed; src/lib/pushNotifications.ts
      registers token → user_preferences.fcm_token, foreground + tap handlers)
- [x] Supabase Edge Function for sending notifications (send-push + _shared/push)
- [x] In-app notification settings UI (NotificationSettings: master toggle,
      brief time+timezone, section checkboxes, task-reminders toggle, test button)
- [x] Daily brief push notification (daily-brief-push fn + DailyBriefModal + bell
      + useDailyBriefs; replaces Telegram)
- [x] Task due date notifications (task-reminders fn: 8AM digest + 1hr-before)
- [x] Habit reminder notifications (habit-reminders fn + per-habit reminder_time UI)

## Final Steps
- [x] Supabase migrations pushed (019/020/021 applied; pg_cron jobs scheduled —
      need app.supabase_url/anon_key GUCs + deployed functions to actually fire)
- [x] npm run build passing
- [ ] Git pushed (this commit)
