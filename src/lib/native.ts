// Small device helpers for the web/PWA build. This used to bridge to Capacitor
// native plugins; the native shells were removed, so the only thing left is a
// best-effort haptic tap backed by the Web Vibration API (Android browsers /
// installed PWA). No-op wherever the API is unavailable (e.g. iOS Safari).

/** Light haptic tap — task/habit/workout completion. Safe to call anywhere. */
export function haptic(): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
    }
  } catch {
    /* ignore — haptics are best-effort */
  }
}
