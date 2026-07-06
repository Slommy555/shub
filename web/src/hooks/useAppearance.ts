import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { watchUserPrefs } from '../lib/userPrefs';

/** Semantic colors the user can customize. Hex strings. */
export interface Appearance {
  bg: string; // page background
  surface: string; // cards / panels (foreground surfaces)
  text: string; // primary text
  muted: string; // secondary / muted text
  border: string; // borders & dividers
  accent: string; // primary buttons, active states, highlights
  accentText: string; // text/icon on top of accent
}

/** Sensible defaults that mirror the built-in light theme. */
export const DEFAULT_APPEARANCE: Appearance = {
  bg: '#f9fafb',
  surface: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  accent: '#1f2937',
  accentText: '#ffffff',
};

export const APPEARANCE_FIELDS: { key: keyof Appearance; label: string; hint: string }[] = [
  { key: 'bg', label: 'Background', hint: 'The page behind everything.' },
  { key: 'surface', label: 'Foreground', hint: 'Cards, panels and inputs.' },
  { key: 'text', label: 'Text', hint: 'Primary text color.' },
  { key: 'muted', label: 'Muted text', hint: 'Secondary labels and hints.' },
  { key: 'border', label: 'Borders', hint: 'Lines and dividers.' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, active tabs, highlights.' },
  { key: 'accentText', label: 'Accent text', hint: 'Text on top of the accent.' },
];

const STORAGE_KEY = 'appearance';

interface Stored {
  enabled: boolean;
  colors: Appearance;
}

function load(): Stored {
  const fallback: Stored = { enabled: false, colors: DEFAULT_APPEARANCE };
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      enabled: Boolean(parsed.enabled),
      colors: { ...DEFAULT_APPEARANCE, ...(parsed.colors ?? {}) },
    };
  } catch {
    return fallback;
  }
}

/** Coerce a Supabase `custom_colors` jsonb value into a Stored, or null. */
function normalize(raw: unknown): Stored | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { enabled?: unknown; colors?: unknown };
  return {
    enabled: Boolean(o.enabled),
    colors: { ...DEFAULT_APPEARANCE, ...(o.colors && typeof o.colors === 'object' ? o.colors : {}) },
  };
}

function apply(enabled: boolean, colors: Appearance) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (enabled) {
    root.setAttribute('data-theme-custom', 'on');
    root.style.setProperty('--c-bg', colors.bg);
    root.style.setProperty('--c-surface', colors.surface);
    root.style.setProperty('--c-text', colors.text);
    root.style.setProperty('--c-muted', colors.muted);
    root.style.setProperty('--c-border', colors.border);
    root.style.setProperty('--c-accent', colors.accent);
    root.style.setProperty('--c-accent-text', colors.accentText);
  } else {
    root.removeAttribute('data-theme-custom');
  }
}

/**
 * Custom color theming, synced across a user's devices. Applied via CSS vars
 * (see index.css `html[data-theme-custom]`). The last value is cached in
 * localStorage and applied instantly on load (no flash); once signed in it is
 * reconciled with Supabase `user_preferences.custom_colors` and kept live via a
 * realtime subscription. Writes are optimistic: local state updates first, then
 * the change is persisted.
 */
export function useAppearance(userId?: string | null) {
  const [state, setState] = useState<Stored>(load);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Cache locally + apply to the DOM whenever it changes (also covers values
  // arriving from the realtime subscription).
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    apply(state.enabled, state.colors);
  }, [state]);

  // Persist to Supabase. The whole {enabled, colors} object is written from the
  // current (realtime-reconciled) local state, which is the merged result.
  const persist = useCallback(
    (next: Stored) => {
      if (!userId) return;
      void supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, custom_colors: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        )
        .then(({ error }) => {
          if (error) console.error('Failed to save appearance:', error.message);
        });
    },
    [userId]
  );

  // On login: adopt the saved palette, or migrate existing local customization up.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('custom_colors')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('Failed to load appearance:', error.message);
        return;
      }
      const remote = normalize(data?.custom_colors);
      if (remote) {
        setState(remote); // reconcile localStorage cache with the server
      } else if (stateRef.current.enabled) {
        persist(stateRef.current); // push existing local customization up
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, persist]);

  // Realtime + focus/visibility reconnect (see watchUserPrefs).
  useEffect(() => {
    if (!userId) return;
    return watchUserPrefs(userId, 'appearance', (row) => {
      const remote = normalize(row.custom_colors);
      if (remote) setState(remote);
    });
  }, [userId]);

  const setEnabled = useCallback(
    (enabled: boolean) => {
      const next: Stored = { ...stateRef.current, enabled };
      setState(next);
      persist(next);
    },
    [persist]
  );

  const setColor = useCallback(
    (key: keyof Appearance, value: string) => {
      const next: Stored = { enabled: true, colors: { ...stateRef.current.colors, [key]: value } };
      setState(next);
      persist(next);
    },
    [persist]
  );

  const reset = useCallback(() => {
    const next: Stored = { enabled: false, colors: DEFAULT_APPEARANCE };
    setState(next);
    persist(next);
  }, [persist]);

  return { enabled: state.enabled, colors: state.colors, setEnabled, setColor, reset };
}
