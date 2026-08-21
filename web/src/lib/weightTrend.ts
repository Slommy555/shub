// The body-weight trend shown on Home and in Workout → Weight.
//
// It's a rolling comparison of two adjacent windows, never a calendar week: the
// mean of the last `days` days (today−13 … today at the default 14) minus the
// mean of the `days` before that (today−27 … today−14). Anchoring on today
// rather than on a Monday means the number moves every day instead of snapping
// back to zero at a week boundary, and averaging both sides absorbs the daily
// water/food swing that makes any two single readings a bad comparison.
//
// 14 days rather than 7 because the sampling noise on a weekly mean is roughly
// the same size as a week's real loss — two weeks a side halves that noise, at
// the cost of the number reacting a little slower to a genuine change.

import { addDays, todayISO } from './dates';
import { mondayOf, parseISODate, round1, toISODate } from './workout';

/** Days per window. Both sides use it, so the two are always comparable. */
export const TREND_WINDOW_DAYS = 14;

/**
 * Below this many readings a window is an average in name only, and the delta
 * is really a comparison of one or two weigh-ins — flagged with a "~".
 */
const MIN_CONFIDENT_ENTRIES = 3;

/** The shape both callers need — any `{ logged_at, weight_lbs }` row works. */
export interface WeightEntry {
  logged_at: string;
  weight_lbs: number;
}

export interface WeightTrend {
  /** Window size in days, so labels can say what they measured. */
  days: number;
  /** recent window mean, or null when that window is empty. */
  recentAvg: number | null;
  /** the window before that, or null when it's empty. */
  previousAvg: number | null;
  /** recentAvg − previousAvg, rounded to 1dp. null when either side is empty. */
  delta: number | null;
  /** A thinly-logged window still averages, but says so with a "~". */
  lowConfidence: boolean;
  recentCount: number;
  previousCount: number;
  /** The exact days each mean covers, so the UI can show its work. */
  recentFrom: string;
  recentTo: string;
  previousFrom: string;
  previousTo: string;
}

/** Mean weight of the entries logged in [from, to] inclusive. */
function windowStats(
  entries: WeightEntry[],
  from: string,
  to: string
): { avg: number | null; count: number } {
  let sum = 0;
  let n = 0;
  for (const e of entries) {
    const day = e.logged_at.slice(0, 10);
    if (day < from || day > to) continue;
    // Postgres numerics can arrive as strings.
    const w = Number(e.weight_lbs);
    if (!Number.isFinite(w)) continue;
    sum += w;
    n += 1;
  }
  return { avg: n > 0 ? sum / n : null, count: n };
}

/** The rolling two-window trend as of `today` (defaults to the local day). */
export function weightTrend(
  entries: WeightEntry[],
  today = todayISO(),
  days = TREND_WINDOW_DAYS
): WeightTrend {
  const recentFrom = addDays(today, -(days - 1));
  const previousTo = addDays(today, -days);
  const previousFrom = addDays(today, -(2 * days - 1));
  const recent = windowStats(entries, recentFrom, today);
  const previous = windowStats(entries, previousFrom, previousTo);
  const both = recent.avg !== null && previous.avg !== null;
  return {
    days,
    recentAvg: recent.avg,
    previousAvg: previous.avg,
    delta: both ? round1(recent.avg! - previous.avg!) : null,
    lowConfidence:
      both &&
      (recent.count < MIN_CONFIDENT_ENTRIES || previous.count < MIN_CONFIDENT_ENTRIES),
    recentCount: recent.count,
    previousCount: previous.count,
    recentFrom,
    recentTo: today,
    previousFrom,
    previousTo,
  };
}

/**
 * A rolling mean at every logged day: the point for day D is the mean of every
 * entry in [D−(days−1), D]. This is the series the trend number is a difference
 * of, which the calendar-week average is not — a Monday-bucketed week mixes a
 * full 7 days against however many days of the current week have elapsed, and
 * shifts which readings it contains only once a week instead of every day.
 */
export function rollingAverageSeries(
  entries: WeightEntry[],
  days = TREND_WINDOW_DAYS
): { date: string; weight: number }[] {
  const dates = Array.from(new Set(entries.map((e) => e.logged_at.slice(0, 10)))).sort();
  const out: { date: string; weight: number }[] = [];
  for (const date of dates) {
    const { avg } = windowStats(entries, addDays(date, -(days - 1)), date);
    if (avg !== null) out.push({ date, weight: round1(avg) });
  }
  return out;
}

/**
 * Calendar Mon–Sun buckets, one point per week, keyed by that week's Monday.
 * The newest point covers only the days elapsed so far, so it sits low or high
 * depending on which days of the week are missing — read the completed weeks
 * for the slope, not the last point for a number.
 */
export function weeklyAverageSeries(
  entries: WeightEntry[]
): { date: string; weight: number }[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const e of entries) {
    const w = Number(e.weight_lbs);
    if (!Number.isFinite(w)) continue;
    const key = toISODate(mondayOf(parseISODate(e.logged_at.slice(0, 10))));
    const cur = map.get(key) ?? { sum: 0, count: 0 };
    cur.sum += w;
    cur.count += 1;
    map.set(key, cur);
  }
  return Array.from(map.entries())
    .map(([date, { sum, count }]) => ({ date, weight: round1(sum / count) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** "↑ 0.4lb" / "~↓ 1.2lb" / "→ 0.0lb", or "Not enough data". */
export function formatWeightDelta(t: WeightTrend): string {
  if (t.delta === null) return 'Not enough data';
  // Direction comes off the rounded number, so a +0.02 drift reads "→ 0.0lb"
  // rather than claiming an increase it can't show.
  const arrow = t.delta > 0 ? '↑' : t.delta < 0 ? '↓' : '→';
  return `${t.lowConfidence ? '~' : ''}${arrow} ${Math.abs(t.delta).toFixed(1)}lb`;
}

/** The full label: "↑ 0.4lb (14d avg)". */
export function formatWeightTrend(t: WeightTrend): string {
  if (t.delta === null) return 'Not enough data';
  return `${formatWeightDelta(t)} (${t.days}d avg)`;
}

/**
 * The two numbers the delta is the difference of — "211.9 vs 211.0". Shown next
 * to the arrow so the figure can be checked against the entries by hand, which
 * is the only way to tell a real move from a thin window.
 */
export function formatTrendBasis(t: WeightTrend): string | null {
  if (t.recentAvg === null || t.previousAvg === null) return null;
  return `${round1(t.recentAvg)} vs ${round1(t.previousAvg)}`;
}

/** "9 of 14 days vs 4 of 14" — how much of each window was actually logged. */
export function formatTrendCoverage(t: WeightTrend): string {
  return `${t.recentCount} of ${t.days} days vs ${t.previousCount} of ${t.days}`;
}
