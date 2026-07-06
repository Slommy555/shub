import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { watchUserPrefs } from '../../lib/userPrefs';

const STORAGE_KEY = 'workoutPrefs.showRpe';

function loadCached(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/**
 * The user's "Display RPE" workout preference (`user_preferences.show_rpe`,
 * default false), synced across devices via the shared realtime subscription.
 * Cached in localStorage for an instant, offline-friendly read. Writes are
 * optimistic and degrade gracefully if the `show_rpe` column hasn't been
 * migrated to the remote yet — the toggle still works on-device.
 */
export function useWorkoutPrefs(userId?: string | null) {
  const [showRpe, setShowRpe] = useState<boolean>(loadCached);
  const showRpeRef = useRef(showRpe);
  showRpeRef.current = showRpe;

  const applyValue = useCallback((v: boolean) => {
    setShowRpe(v);
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {
      /* ignore quota errors */
    }
  }, []);

  // Initial load from Supabase.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('show_rpe')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Failed to load workout prefs:', error.message);
        return;
      }
      if (data && typeof data.show_rpe === 'boolean') applyValue(data.show_rpe);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, applyValue]);

  // Realtime + focus/visibility reconnect (see watchUserPrefs).
  useEffect(() => {
    if (!userId) return;
    return watchUserPrefs(userId, 'workout', (row) => {
      if (typeof row.show_rpe === 'boolean') applyValue(row.show_rpe);
    });
  }, [userId, applyValue]);

  const set = useCallback(
    (v: boolean) => {
      applyValue(v); // optimistic + cached
      if (!userId) return;
      void supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, show_rpe: v, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save show_rpe:', error.message);
        });
    },
    [userId, applyValue]
  );

  return { showRpe, setShowRpe: set };
}

export type UseWorkoutPrefs = ReturnType<typeof useWorkoutPrefs>;
