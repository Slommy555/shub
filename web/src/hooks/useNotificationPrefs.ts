import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface NotificationSections {
  schedule: boolean;
  tasks: boolean;
  habits: boolean;
  workout: boolean;
  budget: boolean;
  notes: boolean;
}

export interface NotificationPrefs {
  notification_enabled: boolean;
  notification_time: string; // "HH:MM"
  notification_timezone: string;
  notification_sections: NotificationSections;
  task_reminders_enabled: boolean;
}

const DEFAULTS: NotificationPrefs = {
  notification_enabled: false,
  notification_time: '07:00',
  notification_timezone: 'America/Los_Angeles',
  notification_sections: {
    schedule: true, tasks: true, habits: true, workout: true, budget: true, notes: true,
  },
  task_reminders_enabled: true,
};

const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULTS.notification_timezone;
  } catch {
    return DEFAULTS.notification_timezone;
  }
};

/** Reads and persists the user's push-notification preferences. */
export function useNotificationPrefs(userId: string | null) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setPrefs(DEFAULTS);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_preferences')
        .select('notification_enabled, notification_time, notification_timezone, notification_sections, task_reminders_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setPrefs({
          notification_enabled: data.notification_enabled ?? false,
          notification_time: (data.notification_time ?? '07:00').slice(0, 5),
          notification_timezone: data.notification_timezone || browserTz(),
          notification_sections: { ...DEFAULTS.notification_sections, ...(data.notification_sections ?? {}) },
          task_reminders_enabled: data.task_reminders_enabled ?? true,
        });
      } else {
        setPrefs({ ...DEFAULTS, notification_timezone: browserTz() });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    async (patch: Partial<NotificationPrefs>) => {
      if (!userId) return;
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        void supabase
          .from('user_preferences')
          .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
          .then(({ error }) => {
            if (error) console.error('save notification prefs failed:', error.message);
          });
        return next;
      });
    },
    [userId]
  );

  return { prefs, loading, save };
}
