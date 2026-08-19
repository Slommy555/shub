// Water tracking: the day-keyed totals every water view derives from, plus the
// quick-add presets. The presets and the last-used amount are per-user UI
// preferences with no reason to round-trip to Supabase — they only affect which
// buttons this device shows, so localStorage is the right home for them.

import { addDays } from './dates';

export const DEFAULT_PRESETS = [8, 12, 16, 20];

/** The bit of a water log the totals care about. */
interface DatedOz {
  logged_at: string;
  oz: number;
}

/**
 * Oz logged per calendar day. This is the whole of the "daily reset": rows carry
 * the day they count toward, so a new day simply has no rows yet and totals 0,
 * while every previous day keeps whatever it had.
 */
export function totalsByDate(logs: DatedOz[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of logs) {
    // Postgres numerics can arrive as strings.
    const oz = Number(l.oz);
    if (!Number.isFinite(oz)) continue;
    map.set(l.logged_at, (map.get(l.logged_at) ?? 0) + oz);
  }
  return map;
}

/** `days` days ending at `today`, oldest → newest, zero-filled. */
export function dailyTotals(
  logs: DatedOz[],
  today: string,
  days: number
): { date: string; oz: number }[] {
  const totals = totalsByDate(logs);
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(today, i - (days - 1));
    return { date, oz: totals.get(date) ?? 0 };
  });
}

const presetsKey = (userId: string) => `water-presets:${userId}`;
const lastOzKey = (userId: string) => `water-last-oz:${userId}`;

/** The four quick-add amounts, falling back to the defaults for anything odd. */
export function loadPresets(userId: string): number[] {
  try {
    const raw = localStorage.getItem(presetsKey(userId));
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_PRESETS;
    const nums = parsed.map(Number);
    if (nums.length !== DEFAULT_PRESETS.length || nums.some((n) => !Number.isFinite(n) || n <= 0)) {
      return DEFAULT_PRESETS;
    }
    return nums;
  } catch {
    return DEFAULT_PRESETS;
  }
}

export function savePresets(userId: string, presets: number[]): void {
  try {
    localStorage.setItem(presetsKey(userId), JSON.stringify(presets));
  } catch {
    /* private mode / quota — the presets just don't stick */
  }
}

/** The amount the compact Home card offers: whatever was last logged. */
export function loadLastOz(userId: string, fallback = DEFAULT_PRESETS[2]): number {
  try {
    const n = Number(localStorage.getItem(lastOzKey(userId)));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

export function saveLastOz(userId: string, oz: number): void {
  try {
    localStorage.setItem(lastOzKey(userId), String(oz));
  } catch {
    /* see savePresets */
  }
}

/** "48 / 64 oz" — drops a trailing .0 so whole numbers stay clean. */
export function formatOz(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

/** "2:34 PM" from a timestamptz. */
export function formatLogTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
