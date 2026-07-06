import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { useAuthContext } from '../hooks/useAuth';
import type { ColorKey } from './types';

export type ThemePref = 'light' | 'dark' | 'system';
export type Scheme = 'light' | 'dark';

export interface Palette {
  /** page/screen root — UI_SKILL bg-base */
  bg: string;
  /** cards, modals, sheets, tab bar — UI_SKILL bg-elevated */
  surface: string;
  /** inputs, secondary cards, hover — UI_SKILL bg-surface */
  surfaceAlt: string;
  /** tooltips, dropdowns, popovers, drag handle — UI_SKILL bg-overlay */
  overlay: string;
  /** primary text — warm white */
  text: string;
  /** secondary text — muted purple-gray */
  muted: string;
  /** placeholder / disabled — UI_SKILL text-tertiary */
  textTertiary: string;
  /** barely-visible card borders / dividers */
  border: string;
  /** stronger borders for inputs / focused elements */
  borderStrong: string;
  /** primary lavender accent — CTAs, active tabs, highlights */
  accent: string;
  /** secondary accent — inactive indicators, secondary borders */
  accentMuted: string;
  /** very subtle accent tint — selected rows */
  accentSubtle: string;
  /** text/icon color that sits on top of `accent` */
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  /** skeleton loader base */
  skeleton: string;
}

// Dark mode is the primary experience (UI_SKILL: "deep space, quiet luxury").
const DARK: Palette = {
  bg: '#16161f',
  surface: '#1e1e2e',
  surfaceAlt: '#252538',
  overlay: '#2d2d45',
  text: '#f0eeff',
  muted: '#8b8aa8',
  textTertiary: '#56556a',
  border: '#2e2e45',
  borderStrong: '#3d3d5c',
  accent: '#b8a9f5',
  accentMuted: '#7c6fb0',
  accentSubtle: '#2a2545',
  accentText: '#16161f',
  success: '#4caf82',
  warning: '#f0a04b',
  danger: '#e05c5c',
  info: '#5c9eff',
  skeleton: '#252538',
};

const LIGHT: Palette = {
  bg: '#f4f3ff',
  surface: '#ffffff',
  surfaceAlt: '#eeecff',
  overlay: '#e8e6ff',
  text: '#1a1830',
  muted: '#6b6888',
  textTertiary: '#a09db8',
  border: '#e0ddf5',
  borderStrong: '#c8c4e8',
  accent: '#7c6fb0',
  accentMuted: '#b8a9f5',
  accentSubtle: '#ede9ff',
  accentText: '#ffffff',
  success: '#4caf82',
  warning: '#f0a04b',
  danger: '#e05c5c',
  info: '#5c9eff',
  skeleton: '#eeecff',
};

// Category / habit badge tints per ColorKey, matching the web COLOR_STYLES.
const TINTS: Record<ColorKey, { l: [string, string]; d: [string, string] }> = {
  gray: { l: ['#e5e7eb', '#374151'], d: ['rgba(107,114,128,0.25)', '#d1d5db'] },
  red: { l: ['#fee2e2', '#b91c1c'], d: ['rgba(239,68,68,0.20)', '#fca5a5'] },
  amber: { l: ['#fef3c7', '#b45309'], d: ['rgba(245,158,11,0.20)', '#fcd34d'] },
  green: { l: ['#dcfce7', '#15803d'], d: ['rgba(34,197,94,0.20)', '#86efac'] },
  teal: { l: ['#ccfbf1', '#0f766e'], d: ['rgba(20,184,166,0.20)', '#5eead4'] },
  blue: { l: ['#dbeafe', '#1d4ed8'], d: ['rgba(59,130,246,0.20)', '#93c5fd'] },
  indigo: { l: ['#e0e7ff', '#4338ca'], d: ['rgba(99,102,241,0.20)', '#a5b4fc'] },
  purple: { l: ['#f3e8ff', '#7e22ce'], d: ['rgba(168,85,247,0.20)', '#d8b4fe'] },
  pink: { l: ['#fce7f3', '#be185d'], d: ['rgba(236,72,153,0.20)', '#f9a8d4'] },
};

/** Solid accent swatch per color (for dots / pickers), matches web COLOR_DOT. */
export const COLOR_DOT_HEX: Record<ColorKey, string> = {
  gray: '#9ca3af',
  red: '#ef4444',
  amber: '#f59e0b',
  green: '#22c55e',
  teal: '#14b8a6',
  blue: '#3b82f6',
  indigo: '#6366f1',
  purple: '#a855f7',
  pink: '#ec4899',
};

interface ThemeValue {
  pref: ThemePref;
  scheme: Scheme;
  colors: Palette;
  setTheme: (p: ThemePref) => void;
  /** Badge {bg, text} for a category/habit color in the active scheme. */
  tint: (c: ColorKey) => { bg: string; text: string };
}

const ThemeContext = createContext<ThemeValue | null>(null);

const CACHE_KEY = 'theme-pref';

function isPref(v: unknown): v is ThemePref {
  return v === 'light' || v === 'dark' || v === 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const [pref, setPref] = useState<ThemePref>('system');
  const [systemScheme, setSystemScheme] = useState<Scheme>(
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const prefRef = useRef(pref);
  prefRef.current = pref;

  // Instant load of the last-known preference (no flash before Supabase resolves).
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then((v) => {
      if (isPref(v)) setPref(v);
    });
  }, []);

  // Track OS light/dark while pref === 'system'.
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) =>
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light')
    );
    return () => sub.remove();
  }, []);

  // On login: adopt the stored preference (or seed it if the row lacks one).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || error) return;
      if (data && isPref(data.theme)) {
        setPref(data.theme);
        AsyncStorage.setItem(CACHE_KEY, data.theme);
      } else {
        await supabase
          .from('user_preferences')
          .upsert(
            { user_id: userId, theme: prefRef.current, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Realtime: a theme change on the web app updates the phone live.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`prefs-theme-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` },
        (payload) => {
          const t = (payload.new as { theme?: unknown })?.theme;
          if (isPref(t)) {
            setPref(t);
            AsyncStorage.setItem(CACHE_KEY, t);
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const setTheme = useCallback(
    (next: ThemePref) => {
      setPref(next);
      AsyncStorage.setItem(CACHE_KEY, next);
      if (!userId) return;
      void supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, theme: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    },
    [userId]
  );

  const scheme: Scheme = pref === 'system' ? systemScheme : pref;
  const colors = scheme === 'dark' ? DARK : LIGHT;

  const tint = useCallback(
    (c: ColorKey) => {
      const t = TINTS[c] ?? TINTS.gray;
      const [bg, text] = scheme === 'dark' ? t.d : t.l;
      return { bg, text };
    },
    [scheme]
  );

  const value = useMemo<ThemeValue>(
    () => ({ pref, scheme, colors, setTheme, tint }),
    [pref, scheme, colors, setTheme, tint]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
