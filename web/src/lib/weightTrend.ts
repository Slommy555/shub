// The body-weight trend shown on Home and in Workout → Weight.
//
// It's a rolling 14-day comparison, never a calendar week: the mean of the
// entries in the last 7 days (today−6 … today) minus the mean of the 7 days
// before that (today−13 … today−7). Anchoring on today rather than on a Monday
// means the number moves every day instead of snapping back to zero at a week
// boundary, and averaging both sides absorbs the daily water/food swing that
// makes any two single readings a bad comparison.

import { addDays, todayISO } from './dates';
import { round1 } from './workout';

/** The shape both callers need — any `{ logged_at, weight_lbs }` row works. */
export interface WeightEntry {
  logged_at: string;
  weight_lbs: number;
}

export interface WeightTrend {
  /** recent 7-day mean, or null when that window is empty. */
  recentAvg: number | null;
  /** the 7 days before that, or null when that window is empty. */
  previousAvg: number | null;
  /** recentAvg − previousAvg, rounded to 1dp. null when either side is empty. */
  delta: number | null;
  /** A window with a single entry still averages, but says so with a "~". */
  lowConfidence: boolean;
  recentCount: number;
  previousCount: number;
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

/** The rolling 14-day trend as of `today` (defaults to the local calendar day). */
export function weightTrend(entries: WeightEntry[], today = todayISO()): WeightTrend {
  const recent = windowStats(entries, addDays(today, -6), today);
  const previous = windowStats(entries, addDays(today, -13), addDays(today, -7));
  const both = recent.avg !== null && previous.avg !== null;
  return {
    recentAvg: recent.avg,
    previousAvg: previous.avg,
    delta: both ? round1(recent.avg! - previous.avg!) : null,
    // One reading on either side is an "average" of one — still worth showing,
    // but flagged so it doesn't read as firmly as a real week of data.
    lowConfidence: both && (recent.count < 2 || previous.count < 2),
    recentCount: recent.count,
    previousCount: previous.count,
  };
}

/** "↑ 0.4lb" / "~↓ 1.2lb" / "→ 0.0lb", or "Not enough data". */
export function formatWeightDelta(t: WeightTrend): string {
  if (t.delta === null) return 'Not enough data';
  // Direction comes off the rounded number, so a +0.02 drift reads "→ 0.0lb"
  // rather than claiming an increase it can't show.
  const arrow = t.delta > 0 ? '↑' : t.delta < 0 ? '↓' : '→';
  return `${t.lowConfidence ? '~' : ''}${arrow} ${Math.abs(t.delta).toFixed(1)}lb`;
}

/** The full label: "↑ 0.4lb (7d avg)". */
export function formatWeightTrend(t: WeightTrend): string {
  if (t.delta === null) return 'Not enough data';
  return `${formatWeightDelta(t)} (7d avg)`;
}
