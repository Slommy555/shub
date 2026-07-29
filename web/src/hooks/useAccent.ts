import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { watchUserPrefs } from '../lib/userPrefs';
import { applyAccent, isHex, DEFAULT_ACCENT_ID } from '../lib/accent';

const STORAGE_KEY = 'accentColor';

function load(): string | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw && isHex(raw) ? raw : null;
}

// Apply the cached value before React mounts so there's no flash of lavender.
applyAccent(load());

/**
 * The user's accent color, synced across devices. `null` means the built-in
 * lavender (the CSS defaults in index.css). Stored as a single base hex in
 * `user_preferences.accent_color`; the ten shades are derived from it.
 *
 * Same shape as useAppearance: localStorage for instant paint, Supabase for
 * sync, realtime for live updates, optimistic writes.
 */
export function useAccent(userId?: string | null) {
  const [color, setColorState] = useState<string | null>(load);
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    if (color) localStorage.setItem(STORAGE_KEY, color);
    else localStorage.removeItem(STORAGE_KEY);
    applyAccent(color);
  }, [color]);

  const persist = useCallback(
    (next: string | null) => {
      if (!userId) return;
      void supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, accent_color: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save accent color:', error.message);
        });
    },
    [userId]
  );

  // On login: adopt the saved color, or push a local choice up if the server
  // has none yet.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('accent_color')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || error) return;
      const remote = typeof data?.accent_color === 'string' ? data.accent_color : null;
      if (remote && isHex(remote)) setColorState(remote);
      else if (remote === null && colorRef.current) persist(colorRef.current);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, persist]);

  useEffect(() => {
    if (!userId) return;
    return watchUserPrefs(userId, 'accent', (row) => {
      const next = (row as { accent_color?: unknown }).accent_color;
      if (typeof next === 'string' && isHex(next)) setColorState(next);
      else if (next === null) setColorState(null);
    });
  }, [userId]);

  const setColor = useCallback(
    (next: string | null) => {
      const value = next && isHex(next) ? next.toLowerCase() : null;
      setColorState(value);
      persist(value);
    },
    [persist]
  );

  const reset = useCallback(() => setColor(null), [setColor]);

  return { color, isDefault: color === null, defaultId: DEFAULT_ACCENT_ID, setColor, reset };
}

export type UseAccent = ReturnType<typeof useAccent>;
