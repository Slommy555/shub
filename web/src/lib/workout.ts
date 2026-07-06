// Shared helpers for the Workout Logger feature. Kept separate from the app's
// existing lib/dates.ts (which uses Sunday-start weeks) because the workout
// metrics use Monday–Sunday weeks.

import type { WorkoutSet } from '../types/workout';

// --- date helpers (Monday-start weeks) -------------------------------------

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday 00:00 of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (out.getDay() + 6) % 7; // 0 = Monday
  out.setDate(out.getDate() - dow);
  return out;
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** [start, end) range for the current Monday–Sunday week. */
export function thisWeekRange(now = new Date()): { start: Date; end: Date } {
  const start = mondayOf(now);
  const end = addDays(start, 7);
  return { start, end };
}

export function formatRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const last = addDays(end, -1);
  return `${start.toLocaleDateString(undefined, opts)} – ${last.toLocaleDateString(undefined, opts)}`;
}

export function formatDate(iso: string): string {
  return parseISODate(iso.slice(0, 10)).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// --- volume + metrics ------------------------------------------------------

/** Volume of a single set = weight × reps (0 when either is missing). */
export function setVolume(s: Pick<WorkoutSet, 'weight_lbs' | 'reps'>): number {
  return (s.weight_lbs ?? 0) * (s.reps ?? 0);
}

export function totalVolume(sets: Pick<WorkoutSet, 'weight_lbs' | 'reps'>[]): number {
  return sets.reduce((acc, s) => acc + setVolume(s), 0);
}

/** Heat level 0..4 for the muscle map, from sets-this-week count. */
export function heatLevel(sets: number): 0 | 1 | 2 | 3 | 4 {
  if (sets <= 0) return 0;
  if (sets <= 3) return 1;
  if (sets <= 6) return 2;
  if (sets <= 10) return 3;
  return 4;
}

/** Opacity per heat level for the single-accent-color heat map. */
export const HEAT_OPACITY: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 0,
  1: 0.25,
  2: 0.45,
  3: 0.7,
  4: 1,
};

export const HEAT_LABELS: { level: 0 | 1 | 2 | 3 | 4; label: string }[] = [
  { level: 0, label: '0' },
  { level: 1, label: '1–3' },
  { level: 2, label: '4–6' },
  { level: 3, label: '7–10' },
  { level: 4, label: '10+' },
];

// --- simple linear regression (for the body-weight trend line) -------------

/** Least-squares fit; returns slope/intercept for y = slope*x + intercept. */
export function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  let sx = 0;
  let sy = 0;
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
    sxy += p.x * p.y;
    sxx += p.x * p.x;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Fallback rest used when an exercise has no configured rest. */
export const DEFAULT_REST_SECONDS = 90;

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** A single accent color used across the workout charts/heat map. */
export const ACCENT = '#374151'; // gray-700 — matches the app's grayscale accent
export const MUSCLE_PALETTE = [
  '#374151', '#6b7280', '#9ca3af', '#111827', '#4b5563', '#d1d5db',
  '#1f2937', '#52525b', '#71717a', '#3f3f46', '#18181b', '#a1a1aa',
  '#27272a', '#52525b', '#737373', '#404040',
];
