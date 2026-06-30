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

async function getRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

interface ShowOpts {
  id: string;
  title: string;
  body?: string | null;
}

/** Show a reminder notification right now (foreground delivery). */
export async function showReminderNow({ id, title, body }: ShowOpts): Promise<void> {
  if (notifPermission() !== 'granted') return;
  const options: NotificationOptions = {
    body: body || undefined,
    tag: `reminder-${id}`,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: '/', id },
  };
  const reg = await getRegistration();
  if (reg) {
    await reg.showNotification(title, options);
  } else {
    try {
      new Notification(title, options);
    } catch {
      /* construction blocked in some contexts; nothing more we can do */
    }
  }
}

/**
 * True when the Notification Triggers API is available (Chromium on Windows /
 * Android). It lets us schedule a notification that fires even if the app is
 * closed — a progressive enhancement over the in-app timer.
 */
export function triggersSupported(): boolean {
  return (
    notificationsSupported() &&
    'showTrigger' in (Notification.prototype as object) &&
    typeof (window as unknown as { TimestampTrigger?: unknown }).TimestampTrigger !== 'undefined'
  );
}

/** Schedule a reminder to fire at `timestamp` via the Triggers API. No-op when
 *  unsupported. Re-scheduling with the same tag replaces the previous one. */
export async function scheduleReminderTrigger({
  id,
  title,
  body,
  timestamp,
}: ShowOpts & { timestamp: number }): Promise<void> {
  if (!triggersSupported() || notifPermission() !== 'granted') return;
  const reg = await getRegistration();
  if (!reg) return;
  const Trigger = (window as unknown as { TimestampTrigger: new (t: number) => unknown })
    .TimestampTrigger;
  try {
    await reg.showNotification(title, {
      body: body || undefined,
      tag: `reminder-${id}`,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: '/', id },
      // Experimental field not in the TS DOM types.
      showTrigger: new Trigger(timestamp),
    } as NotificationOptions);
  } catch {
    /* ignore scheduling failures */
  }
}
