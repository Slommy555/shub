// Native push-notification registration (FCM via Capacitor). No-op on web —
// the plugin is imported dynamically inside the isNative() guard so the web
// bundle never includes it. Web push is handled separately (not yet wired).

import { supabase } from './supabase';
import { isNative } from './native';

type NavigateToTab = (tab: string) => void;

let registered = false;

/**
 * Request permission, register with FCM, persist the token to
 * user_preferences, and wire foreground/tap handlers. Call once after login.
 * `onNavigate` is used when the user taps a notification carrying a `tab`.
 * `onBrief` receives the full daily-brief text when a brief notification is
 * tapped (so the app can open the DailyBriefModal).
 */
export async function registerPushNotifications(
  onNavigate?: NavigateToTab,
  onBrief?: (fullBrief: string) => void
): Promise<void> {
  if (!isNative() || registered) return;
  registered = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;

    await PushNotifications.register();

    await PushNotifications.addListener('registration', async (token) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from('user_preferences')
          .upsert({ user_id: user.id, fcm_token: token.value }, { onConflict: 'user_id' });
        if (error) console.error('Failed to save FCM token:', error.message);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error:', JSON.stringify(err));
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      // Foreground: surface a lightweight in-app cue rather than a system banner.
      window.dispatchEvent(
        new CustomEvent('push:received', { detail: notification })
      );
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification.data as { tab?: string; fullBrief?: string } | undefined;
      if (data?.fullBrief && onBrief) onBrief(data.fullBrief);
      if (data?.tab && onNavigate) onNavigate(data.tab);
    });
  } catch (e) {
    console.error('registerPushNotifications failed:', e);
  }
}
