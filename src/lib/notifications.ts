// Thin wrappers around the Notification + Service Worker APIs. Notifications
// are shown from the service-worker registration whenever possible, since that
// is the only path that works inside an installed PWA (and the only path iOS
// supports at all).

export type NotifPermission = NotificationPermission | 'unsupported';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notifPermission(): NotifPermission {
  if (!notificationsSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestNotifPermission(): Promise<NotifPermission> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/** True when running as an installed/standalone PWA. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari exposes navigator.standalone; everyone else uses display-mode.
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true;
}

/**
 * True when the Notification Triggers API is available (Chromium on Windows /
 * Android). Surfaced in the notifications settings panel as a delivery hint.
 */
export function triggersSupported(): boolean {
  return (
    notificationsSupported() &&
    'showTrigger' in (Notification.prototype as object) &&
    typeof (window as unknown as { TimestampTrigger?: unknown }).TimestampTrigger !== 'undefined'
  );
}
