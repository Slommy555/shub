// Web Push (VAPID) subscription helpers for the browser/PWA. Pairs with the
// `push` handler in public/sw.js and the send-push Edge Function. No Firebase —
// this uses the standard Web Push API, which works in Chrome (desktop +
// Android) and Safari/iOS 16.4+ when the app is installed to the home screen.

import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/** True when this browser can subscribe to Web Push at all. */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Ask for notification permission (if needed) and create/reuse a Web Push
 * subscription for this device. Returns the subscription, or null if
 * unsupported, permission denied, or no VAPID key is configured.
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  if (!VAPID_PUBLIC_KEY) {
    console.error('VITE_VAPID_PUBLIC_KEY is not set — cannot subscribe to push.');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const registration = await navigator.serviceWorker.ready;
  // Reuse an existing subscription if one is already present.
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  return subscription;
}

/** Persist the subscription JSON to user_preferences for the signed-in user. */
export async function savePushSubscription(subscription: PushSubscription): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, push_subscription: JSON.stringify(subscription) },
      { onConflict: 'user_id' }
    );
  if (error) console.error('Failed to save push subscription:', error.message);
}

/**
 * Subscribe + save in one call. Returns true on success. Use when the user
 * turns notifications on.
 */
export async function enablePush(): Promise<boolean> {
  const sub = await subscribeToPush();
  if (!sub) return false;
  await savePushSubscription(sub);
  return true;
}

/** Unsubscribe this device and clear the stored subscription. */
export async function unsubscribeFromPush(): Promise<void> {
  try {
    if (pushSupported()) {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
  } catch {
    /* best-effort */
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from('user_preferences')
    .update({ push_subscription: null })
    .eq('user_id', user.id);
}

// VAPID keys are base64url; the Push API wants the raw bytes as the application
// key. Return an ArrayBuffer (a valid BufferSource) to satisfy the DOM types.
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) view[i] = rawData.charCodeAt(i);
  return buffer;
}
