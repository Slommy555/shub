import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { watchUserPrefs } from '../lib/userPrefs';

/** What the user picked. 'system' follows the OS setting. */
export type ThemePref = 'light' | 'dark' | 'system';
/** What's actually applied to the DOM. */
type Resolved = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function isThemePref(v: unknown): v is ThemePref {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** Last-known preference from localStorage, so the UI doesn't flash before the
 *  Supabase fetch resolves (the pre-paint script in index.html applies it too). */
function getCachedPref(): ThemePref {
  if (typeof window === 'undefined') return 'system';
  const stored = localStorage.getItem(STORAGE_KEY);
  return isThemePref(stored) ? stored : 'system';
}

/**
 * Dark / light theme synced across a user's devices.
 *
 * - Applies the `dark` class to <html> (Tailwind's class strategy).
 * - Caches the preference in localStorage so reloads don't flash the wrong theme.
 * - When signed in, reads/writes the preference from Supabase `user_preferences`
 *   and subscribes to realtime changes, so toggling on one device updates any
 *   other open session live.
 */
export function useTheme(userId?: string | null) {
  const [pref, setPref] = useState<ThemePref>(getCachedPref);
  const [systemDark, setSystemDark] = useState<boolean>(systemPrefersDark);

  // Latest preference, for reads inside callbacks/effects without re-subscribing.
  const prefRef = useRef(pref);
  prefRef.current = pref;

  const resolved: Resolved = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref;

  // Apply to the DOM and cache locally whenever the resolved theme changes.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    localStorage.setItem(STORAGE_KEY, pref);
  }, [resolved, pref]);

  // Track OS scheme changes (only affects the UI while pref === 'system').
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // On login: fetch the stored preference, or create the row if none exists.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Failed to load theme preference:', error.message);
        return;
      }
      if (data && isThemePref(data.theme)) {
        setPref(data.theme); // reconcile localStorage cache with the server
      } else {
        // No row yet — persist the current (local) preference as the default.
        const { error: upErr } = await supabase
          .from('user_preferences')
          .upsert(
            { user_id: userId, theme: prefRef.current, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
        if (upErr) console.error('Failed to create theme preference:', upErr.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Realtime: pick up changes made on another device while this one is open.
  // watchUserPrefs also re-subscribes + reconciles when the tab regains focus,
  // since mobile browsers drop the websocket when backgrounded.
  useEffect(() => {
    if (!userId) return;
    return watchUserPrefs(userId, 'theme', (row) => {
      if (isThemePref(row.theme)) setPref(row.theme);
    });
  }, [userId]);

  /** Set an explicit preference: apply locally first, then sync to Supabase. */
  const setTheme = useCallback(
    (next: ThemePref) => {
      setPref(next); // optimistic
      if (!userId) return;
      void supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, theme: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save theme preference:', error.message);
        });
    },
    [userId]
  );

  // Same sun/moon interaction as before: flip relative to what's shown. This
  // also moves the preference off 'system' to an explicit light/dark.
  const toggleTheme = useCallback(() => {
    const shown: Resolved = prefRef.current === 'system' ? (systemDark ? 'dark' : 'light') : prefRef.current;
    setTheme(shown === 'dark' ? 'light' : 'dark');
  }, [setTheme, systemDark]);

  return { theme: pref, resolvedTheme: resolved, toggleTheme, setTheme };
}
