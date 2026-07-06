import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';

/**
 * Once per login, ask for notification permission and — if granted — fetch the
 * Expo push token and store it on user_preferences.expo_push_token. The token is
 * used later for habit reminders / daily briefs (not built yet).
 *
 * Remote push tokens are NOT available in Expo Go (SDK 53+); in that case we
 * request permission and quietly skip the token step so nothing crashes. Build
 * a dev/production client to obtain a real token.
 */
export function usePushRegistration(userId: string | null) {
  const doneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || doneRef.current === userId) return;
    doneRef.current = userId;

    (async () => {
      try {
        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted') return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
          });
        }

        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          (Constants as any)?.easConfig?.projectId;
        if (!projectId) {
          // Running in Expo Go / no EAS project — can't mint a push token.
          console.log('Skipping push token: no EAS projectId (Expo Go?).');
          return;
        }

        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        const { error } = await supabase
          .from('user_preferences')
          .upsert(
            { user_id: userId, expo_push_token: token, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        if (error) console.error('Failed to save push token:', error.message);
      } catch (e) {
        console.log('Push registration skipped:', (e as Error).message);
      }
    })();
  }, [userId]);
}
