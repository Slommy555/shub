import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Appearance as RNAppearance } from 'react-native';
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

/**
 * Custom palette the user can edit — MUST match the web PWA's `Appearance`
 * (web/src/hooks/useAppearance.ts) exactly so the two apps sync through
 * `user_preferences.custom_colors`. Same 7 semantic keys, same defaults.
 */
export interface Appearance {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentText: string;
}

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
  { key: 'bg', label: 'Background', hint: 'The screen behind everything.' },
  { key: 'surface', label: 'Foreground', hint: 'Cards, sheets and inputs.' },
  { key: 'text', label: 'Text', hint: 'Primary text color.' },
  { key: 'muted', label: 'Muted text', hint: 'Secondary labels and hints.' },
  { key: 'border', label: 'Borders', hint: 'Lines and dividers.' },
  { key: 'accent', label: 'Accent', hint: 'Buttons, active tabs, highlights.' },
  { key: 'accentText', label: 'Accent text', hint: 'Text on top of the accent.' },
];

interface AppearanceState {
  enabled: boolean;
  colors: Appearance;
}

/** Map the flat 7-color custom palette onto the app's richer token set. */
function overridePalette(base: Palette, c: Appearance): Palette {
  return {
    ...base,
    bg: c.bg,
    surface: c.surface,
    surfaceAlt: c.surface,
    overlay: c.surface,
    text: c.text,
    muted: c.muted,
    textTertiary: c.muted,
    border: c.border,
    borderStrong: c.border,
    accent: c.accent,
    accentMuted: c.accent,
    accentSubtle: c.surface,
    accentText: c.accentText,
    skeleton: c.surface,
    // success / warning / danger / info keep their semantic values
  };
}

function normalizeAppearance(raw: unknown): AppearanceState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as { enabled?: unknown; colors?: unknown };
  return {
    enabled: Boolean(o.enabled),
    colors: {
      ...DEFAULT_APPEARANCE,
      ...(o.colors && typeof o.colors === 'object' ? (o.colors as Partial<Appearance>) : {}),
    },
  };
}

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
  // Custom-color editing (synced with the PWA via custom_colors).
  appearanceEnabled: boolean;
  appearanceColors: Appearance;
  setAppearanceEnabled: (on: boolean) => void;
  setAppearanceColor: (key: keyof Appearance, value: string) => void;
  resetAppearance: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

const CACHE_KEY = 'theme-pref';
const APPEARANCE_CACHE_KEY = 'appearance';

function isPref(v: unknown): v is ThemePref {
  return v === 'light' || v === 'dark' || v === 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const [pref, setPref] = useState<ThemePref>('system');
  const [systemScheme, setSystemScheme] = useState<Scheme>(
    RNAppearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const [appearance, setAppearance] = useState<AppearanceState>({
    enabled: false,
    colors: DEFAULT_APPEARANCE,
  });

  const prefRef = useRef(pref);
  prefRef.current = pref;
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;

  // Instant load of last-known values (no flash before Supabase resolves).
  useEffect(() => {
    AsyncStorage.getItem(CACHE_KEY).then((v) => {
      if (isPref(v)) setPref(v);
    });
    AsyncStorage.getItem(APPEARANCE_CACHE_KEY).then((v) => {
      if (!v) return;
      try {
        const parsed = normalizeAppearance(JSON.parse(v));
        if (parsed) setAppearance(parsed);
      } catch {
        /* ignore */
      }
    });
  }, []);

  // Track OS light/dark while pref === 'system'.
  useEffect(() => {
    const sub = RNAppearance.addChangeListener(({ colorScheme }) =>
      setSystemScheme(colorScheme === 'dark' ? 'dark' : 'light')
    );
    return () => sub.remove();
  }, []);

  // On login: adopt stored theme + custom_colors (or seed the row if missing).
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('theme, custom_colors')
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

      const remote = normalizeAppearance(data?.custom_colors);
      if (remote) {
        setAppearance(remote);
        AsyncStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(remote));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Realtime: theme / custom_colors changes on the web app update the phone live.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`prefs-theme-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { theme?: unknown; custom_colors?: unknown };
          if (isPref(row?.theme)) {
            setPref(row.theme);
            AsyncStorage.setItem(CACHE_KEY, row.theme);
          }
          const remote = normalizeAppearance(row?.custom_colors);
          if (remote) {
            setAppearance(remote);
            AsyncStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(remote));
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

  const persistAppearance = useCallback(
    (next: AppearanceState) => {
      AsyncStorage.setItem(APPEARANCE_CACHE_KEY, JSON.stringify(next));
      if (!userId) return;
      void supabase
        .from('user_preferences')
        .upsert(
          { user_id: userId, custom_colors: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    },
    [userId]
  );

  const setAppearanceEnabled = useCallback(
    (on: boolean) => {
      const next: AppearanceState = { ...appearanceRef.current, enabled: on };
      setAppearance(next);
      persistAppearance(next);
    },
    [persistAppearance]
  );

  const setAppearanceColor = useCallback(
    (key: keyof Appearance, value: string) => {
      const next: AppearanceState = {
        enabled: true,
        colors: { ...appearanceRef.current.colors, [key]: value },
      };
      setAppearance(next);
      persistAppearance(next);
    },
    [persistAppearance]
  );

  const resetAppearance = useCallback(() => {
    const next: AppearanceState = { enabled: false, colors: DEFAULT_APPEARANCE };
    setAppearance(next);
    persistAppearance(next);
  }, [persistAppearance]);

  const scheme: Scheme = pref === 'system' ? systemScheme : pref;
  const base = scheme === 'dark' ? DARK : LIGHT;
  const colors = appearance.enabled ? overridePalette(base, appearance.colors) : base;

  const tint = useCallback(
    (c: ColorKey) => {
      const t = TINTS[c] ?? TINTS.gray;
      const [bg, text] = scheme === 'dark' ? t.d : t.l;
      return { bg, text };
    },
    [scheme]
  );

  const value = useMemo<ThemeValue>(
    () => ({
      pref,
      scheme,
      colors,
      setTheme,
      tint,
      appearanceEnabled: appearance.enabled,
      appearanceColors: appearance.colors,
      setAppearanceEnabled,
      setAppearanceColor,
      resetAppearance,
    }),
    [
      pref,
      scheme,
      colors,
      setTheme,
      tint,
      appearance.enabled,
      appearance.colors,
      setAppearanceEnabled,
      setAppearanceColor,
      resetAppearance,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
