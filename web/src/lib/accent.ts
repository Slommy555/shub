// The app's accent color. Every `accent-*` Tailwind utility resolves to a CSS
// variable holding an "R G B" triple (see tailwind.config.js + index.css), so
// re-tinting the whole UI is a matter of writing ten variables onto <html>.

export interface AccentPreset {
  id: string;
  name: string;
  /** The mid-tone the ramp is generated from. */
  base: string;
}

/** `null`/'lavender' means "leave the CSS defaults alone". */
export const DEFAULT_ACCENT_ID = 'lavender';

export const ACCENT_PRESETS: AccentPreset[] = [
  { id: 'lavender', name: 'Lavender', base: '#9b88e8' },
  { id: 'indigo', name: 'Indigo', base: '#6366f1' },
  { id: 'blue', name: 'Blue', base: '#3b82f6' },
  { id: 'teal', name: 'Teal', base: '#14b8a6' },
  { id: 'green', name: 'Green', base: '#22c55e' },
  { id: 'amber', name: 'Amber', base: '#f59e0b' },
  { id: 'rose', name: 'Rose', base: '#f43f5e' },
  { id: 'graphite', name: 'Graphite', base: '#64748b' },
];

export const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

/** Lightness each shade is normalized to (%). Keeps 500/600 dark enough that
 *  white button text stays readable whatever hue the user picks. */
const LIGHTNESS: Record<number, number> = {
  50: 97,
  100: 94,
  200: 88,
  300: 79,
  400: 70,
  500: 60,
  600: 48,
  700: 38,
  800: 29,
  900: 21,
};

/** Saturation multiplier per shade — the extremes ease off so they don't glare. */
const SAT_SCALE: Record<number, number> = {
  50: 0.5,
  100: 0.6,
  200: 0.72,
  300: 0.85,
  400: 0.95,
  500: 1,
  600: 1,
  700: 0.95,
  800: 0.88,
  900: 0.8,
};

export function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/**
 * Build the full accent ramp from one color: hue is kept, lightness is
 * normalized per shade, so any pick lands as a usable, consistent palette
 * instead of ten variations on whatever brightness was chosen.
 */
export function makeRamp(baseHex: string): Record<number, string> {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s] = rgbToHsl(r, g, b);
  const out: Record<number, string> = {};
  for (const shade of SHADES) {
    const [rr, gg, bb] = hslToRgb(h, Math.min(100, s * SAT_SCALE[shade]), LIGHTNESS[shade]);
    out[shade] = `${rr} ${gg} ${bb}`;
  }
  return out;
}

/** WCAG relative luminance of an "R G B" triple. */
function luminance(triple: string): number {
  const [r, g, b] = triple.split(' ').map(Number);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Text/icon color to sit on an accent fill. A bright accent (green, amber…)
 * needs near-black; a deep one needs white. Without this, picking a yellow
 * accent would leave every primary button's white label unreadable.
 */
export function foregroundFor(ramp: Record<number, string>): string {
  return luminance(ramp[600]) > 0.4 ? '10 10 10' : '255 255 255';
}

/** Write (or clear) the ramp on <html>. Clearing falls back to index.css. */
export function applyAccent(baseHex: string | null) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!baseHex || !isHex(baseHex)) {
    for (const shade of SHADES) root.style.removeProperty(`--accent-${shade}`);
    root.style.removeProperty('--accent-fg');
    return;
  }
  const ramp = makeRamp(baseHex);
  for (const shade of SHADES) root.style.setProperty(`--accent-${shade}`, ramp[shade]);
  root.style.setProperty('--accent-fg', foregroundFor(ramp));
}

/** Readable check-mark color to draw on top of a swatch of this color. */
export function onColorFor(baseHex: string): string {
  return foregroundFor(makeRamp(baseHex)) === '255 255 255' ? '#ffffff' : '#0a0a0a';
}

/** The swatch color to show for a preset/custom value in the picker. */
export function swatchFor(baseHex: string): string {
  const ramp = makeRamp(baseHex);
  const [r, g, b] = ramp[500].split(' ').map(Number);
  return `rgb(${r}, ${g}, ${b})`;
}
