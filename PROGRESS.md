# Session Progress — Remove Capacitor/Electron/FCM, revert to PWA + web push

> Supersedes the previous "add Capacitor/Electron/FCM" session. The app already
> had a working hand-rolled PWA (public/sw.js + manifest + icons) BEFORE the
> native shells were added, so Part 4 mostly means "keep the existing PWA".
> We deliberately do NOT install vite-plugin-pwa (would replace the custom
> sw.js; see project memory).

## Part 1 — Remove Capacitor
- [x] Uninstall Capacitor packages (npm install pruned 390 pkgs)
- [x] Delete android/ directory
- [x] Delete capacitor.config.ts
- [x] Remove Capacitor imports/branches (native.ts → web-only haptic; App.tsx; pushNotifications.ts deleted)
- [x] Remove android: scripts from package.json
- [x] Barcode scanner: N/A (no scanner in app)
- [x] npm run build passes, zero @capacitor references

## Part 2 — Remove Electron
- [x] Uninstall Electron packages
- [x] Delete electron/ directory (dist-electron not present)
- [x] Remove Electron checks (native.ts isElectron removed)
- [x] Remove main field, electron: scripts, build block from package.json
- [x] Revert vite.config.ts ELECTRON base branch
- [x] npm run build passes, zero Electron references

## Part 3 — Remove Firebase / FCM
- [x] No firebase npm packages were installed (verified)
- [x] Delete src/lib/pushNotifications.ts + remove call in App.tsx
- [x] Convert _shared/push.ts sendPushToUser FCM → web-push (npm:web-push, VAPID)
- [x] Migration 022: drop fcm_token, add push_subscription, add char_count (pushed)
- [x] KEEP notification_log, NotificationSettings, DailyBriefModal, cron jobs
- [x] FCM comment refs updated; zero live FCM references in src/
- [ ] MANUAL: supabase secrets unset FCM_SERVICE_ACCOUNT

## Part 4 — PWA (already existed — kept intact)
- [x] Manifest, sw.js, icons, apple meta, registerSW, UpdateToast all present
- [x] sw.js push + notificationclick handlers present, unchanged
- [x] npm run build passes; PWA still installable

## Part 5 — Web Push Notifications
- [x] src/lib/webPush.ts (subscribeToPush/savePushSubscription/enablePush/unsubscribe)
- [x] Wire subscribe/unsubscribe to NotificationSettings master toggle
- [x] App.tsx: SW message listener opens brief modal on notification tap
- [x] _shared/push.ts web-push sender (VAPID) + 404/410 subscription cleanup
- [x] daily-brief-push data payload → { type:'daily_brief', fullBrief }
- [x] VITE_VAPID_PUBLIC_KEY: env typing + .env.local + .env.example
- [ ] MANUAL: generate VAPID keys, set secrets, deploy functions (see checklist)

## Final Steps
- [x] Supabase migration 022 pushed
- [x] npm run build passing
- [x] Git pushed
- [x] Setup checklist emitted in session output
