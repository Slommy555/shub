# Session Progress — Remove Capacitor/Electron/FCM, revert to PWA + web push

> Supersedes the previous "add Capacitor/Electron/FCM" session. The app already
> had a working hand-rolled PWA (public/sw.js + manifest + icons) BEFORE the
> native shells were added, so Part 4 mostly means "keep the existing PWA and
> remove nothing that was already there". We deliberately do NOT install
> vite-plugin-pwa (would replace the custom sw.js; see project memory).

## Part 1 — Remove Capacitor
- [ ] Uninstall Capacitor packages
- [ ] Delete android/ directory
- [ ] Delete capacitor.config.ts
- [ ] Remove Capacitor imports/branches from src/ (native.ts, App.tsx, pushNotifications.ts)
- [ ] Remove android: scripts from package.json
- [ ] Barcode scanner: N/A (no scanner in app; nothing to revert)
- [ ] npm run build passes, zero @capacitor references

## Part 2 — Remove Electron
- [ ] Uninstall Electron packages
- [ ] Delete electron/ directory (+ dist-electron if present)
- [ ] Remove Electron checks from src/ (native.ts isElectron)
- [ ] Remove main field, electron: scripts, build block from package.json
- [ ] Revert vite.config.ts ELECTRON base branch
- [ ] npm run build passes, zero Electron references

## Part 3 — Remove Firebase / FCM
- [ ] (No firebase npm packages were installed — verify)
- [ ] Delete src/lib/pushNotifications.ts (Capacitor FCM) + remove call in App.tsx
- [ ] Convert _shared/push.ts sendPushToUser from FCM to web-push
- [ ] Migration: drop fcm_token, add push_subscription, add char_count
- [ ] KEEP notification_log, NotificationSettings, DailyBriefModal, cron jobs
- [ ] Note FCM secret to unset manually (FCM_SERVICE_ACCOUNT)
- [ ] Zero FCM references remain in src/

## Part 4 — PWA (already exists — verify/keep)
- [x] Manifest, sw.js, icons, apple meta, registerSW, UpdateToast already present
- [ ] Confirm sw.js push handler present (it is) and unchanged
- [ ] npm run build passes; PWA still installable

## Part 5 — Web Push Notifications
- [ ] src/lib/webPush.ts (subscribeToPush + savePushSubscription + unsubscribe)
- [ ] Wire subscribe on NotificationSettings master toggle
- [ ] _shared/push.ts web-push sender (VAPID)
- [ ] send-push / daily-brief-push / task-reminders / habit-reminders use web push
- [ ] VITE_VAPID_PUBLIC_KEY consumed on client

## Final Steps
- [ ] Supabase migration pushed
- [ ] npm run build passing
- [ ] Git pushed
- [ ] Setup checklist emitted (VAPID keygen, secrets, etc.)
