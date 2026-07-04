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
- [ ] Firebase Cloud Messaging setup
- [ ] Capacitor push notification plugin
- [ ] Supabase Edge Function for sending notifications
- [ ] In-app notification settings UI
- [ ] Daily brief push notification (replaces Telegram)
- [ ] Task due date notifications
- [ ] Habit reminder notifications

## Final Steps
- [ ] Supabase migrations pushed
- [ ] npm run build passing
- [ ] Git pushed
