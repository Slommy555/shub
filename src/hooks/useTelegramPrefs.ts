import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface TelegramSections {
  schedule: boolean;
  tasks: boolean;
  habits: boolean;
  workout: boolean;
  budget: boolean;
  notes: boolean;
  recommendations: boolean;
}

export interface TelegramPrefs {
  telegram_enabled: boolean;
  telegram_time: string; // "HH:MM"
  telegram_timezone: string;
  telegram_sections: TelegramSections;
}

const DEFAULT_SECTIONS: TelegramSections = {
  schedule: true, tasks: true, habits: true, workout: true, budget: true, notes: true, recommendations: true,
};

const DEFAULTS: TelegramPrefs = {
  telegram_enabled: false,
  telegram_time: '07:00',
  telegram_timezone: 'America/Los_Angeles',
  telegram_sections: DEFAULT_SECTIONS,
};

const browserTz = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULTS.telegram_timezone;
  } catch {
    return DEFAULTS.telegram_timezone;
  }
};

/** Reads and persists the user's Telegram-brief preferences (user_preferences). */
export function useTelegramPrefs(userId: string | null) {
  const [prefs, setPrefs] = useState<TelegramPrefs>(DEFAULTS);
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
        .select('telegram_enabled, telegram_time, telegram_timezone, telegram_sections')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (data) {
        setPrefs({
          telegram_enabled: data.telegram_enabled ?? false,
          telegram_time: (data.telegram_time ?? '07:00').slice(0, 5),
          telegram_timezone: data.telegram_timezone || browserTz(),
          telegram_sections: { ...DEFAULT_SECTIONS, ...(data.telegram_sections ?? {}) },
        });
      } else {
        setPrefs({ ...DEFAULTS, telegram_timezone: browserTz() });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = useCallback(
    async (patch: Partial<TelegramPrefs>) => {
      if (!userId) return;
      setPrefs((prev) => {
        const next = { ...prev, ...patch };
        void supabase
          .from('user_preferences')
          .upsert({ user_id: userId, ...patch }, { onConflict: 'user_id' })
          .then(({ error }) => {
            if (error) console.error('save telegram prefs failed:', error.message);
          });
        return next;
      });
    },
    [userId]
  );

  return { prefs, loading, save };
}
