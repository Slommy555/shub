# Session Spec — Remove Capacitor / Electron / Firebase-FCM, revert to PWA + web push

> Supersedes the previous PROMPT.md ("add Capacitor Android, Electron PC,
> Firebase Push"). Goal: strip out all Capacitor Android, Electron, and
> Firebase/FCM code that was recently added, and ship a clean PWA + Web Push
> (VAPID) setup. Stack: React + Vite + Supabase. The web app must keep working
> perfectly throughout.

## Adaptation notes (repo reality vs. the original literal prompt)
The app already had a complete hand-rolled PWA BEFORE the native shells were
added: `public/sw.js` (with push + notificationclick handlers), a
`manifest.webmanifest`, icons (180/192/512), apple meta tags in index.html,
`src/lib/registerSW.ts`, and `src/components/UpdateToast.tsx`.

Therefore:
- Do NOT install vite-plugin-pwa — it would replace the custom sw.js. Project
  memory says: "public/sw.js (not vite-plugin-pwa) powers reminder
  notifications; don't replace with Workbox generateSW."
- Keep `NotificationSettings.tsx` and `DailyBriefModal.tsx` — they are already
  push-agnostic (they call the `send-push` Edge Function), not FCM-bound.
- Keep the `notification_log` table and the pg_cron jobs (021) — the Edge
  Function names are unchanged; only their internals move FCM → web push.

## Part 1 — Remove Capacitor
Uninstall @capacitor/* packages; delete android/ and capacitor.config.ts;
delete src/lib/native.ts and its imports; remove android: scripts. No barcode
scanner exists in the app, so nothing to revert there.

## Part 2 — Remove Electron
Uninstall electron/electron-builder/electron-updater/concurrently/wait-on/
cross-env; delete electron/ (+ dist-electron); remove "main", electron:* scripts
and the electron-builder "build" block from package.json; revert the ELECTRON
base branch in vite.config.ts.

## Part 3 — Remove Firebase / FCM
No firebase npm packages were installed. Delete src/lib/pushNotifications.ts
(Capacitor FCM registration) and its call in App.tsx. Convert
_shared/push.ts `sendPushToUser` from FCM HTTP v1 to web-push (VAPID). Migration
drops user_preferences.fcm_token, adds push_subscription text, adds
notification_log.char_count. Manual: `supabase secrets unset FCM_SERVICE_ACCOUNT`.

## Part 4 — PWA (already present)
Verify manifest/sw.js/icons/apple-meta remain intact and build stays installable.

## Part 5 — Web Push (VAPID)
- `src/lib/webPush.ts`: subscribeToPush() (Notification.requestPermission +
  pushManager.subscribe with VITE_VAPID_PUBLIC_KEY), savePushSubscription()
  (upsert user_preferences.push_subscription), unsubscribeFromPush().
- Wire subscribe/unsubscribe to the NotificationSettings master toggle.
- Edge Functions send via `npm:web-push` with VAPID secrets:
  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_EMAIL. On 404/410, clear the
  stored subscription.
- The four functions (send-push, daily-brief-push, task-reminders,
  habit-reminders) keep their logic and just call the new web-push sender.

## Setup checklist (manual — run after this session)
- [ ] npx web-push generate-vapid-keys
- [ ] Add VITE_VAPID_PUBLIC_KEY=... to .env.local and Vercel env
- [ ] supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_EMAIL=mailto:you@example.com
- [ ] supabase secrets unset FCM_SERVICE_ACCOUNT
- [ ] npx supabase functions deploy send-push daily-brief-push task-reminders habit-reminders
- [ ] Enable app notifications in Chrome, hit "Send test"
- [ ] iPhone: Add to Home Screen, then enable notifications
