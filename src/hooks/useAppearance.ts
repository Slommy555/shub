import { useCallback, useEffect, useState } from 'react';

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

/** Custom color theming, persisted to localStorage and applied via CSS vars. */
export function useAppearance() {
  const [state, setState] = useState<Stored>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    apply(state.enabled, state.colors);
  }, [state]);

  const setEnabled = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, enabled }));
  }, []);

  const setColor = useCallback((key: keyof Appearance, value: string) => {
    setState((s) => ({ enabled: true, colors: { ...s.colors, [key]: value } }));
  }, []);

  const reset = useCallback(() => {
    setState({ enabled: false, colors: DEFAULT_APPEARANCE });
  }, []);

  return { enabled: state.enabled, colors: state.colors, setEnabled, setColor, reset };
}
