import { toISODate } from '../types/budget';

/**
 * Turning dated savings movements into a running-balance series, bucketed by day,
 * week or month. Pure functions — the hooks fetch the movements, this file shapes
 * them, the chart draws them.
 */

export type SavingsGranularity = 'daily' | 'weekly' | 'monthly';

export const GRANULARITY_LABEL: Record<SavingsGranularity, string> = {
  daily: 'Day',
  weekly: 'Week',
  monthly: 'Month',
};

/** One dated movement of the savings balance. */
export interface SavingsEvent {
  date: string; // YYYY-MM-DD
  delta: number; // signed: + into savings, − out of it
  kind: 'deposit' | 'earmark' | 'manual' | 'balance';
  label: string;
}

/** One point on the trend: what moved inside the bucket, and where it ended. */
export interface SavingsBucket {
  /** The bucket's last day — also the date a hand-edited balance is stored on. */
  key: string;
  start: string;
  end: string;
  /** Terse axis label. */
  label: string;
  /** Spelled-out label for the tooltip and the edit list. */
  fullLabel: string;
  /** Net movement inside the bucket. */
  change: number;
  /** Running balance as of the bucket's last day. */
  balance: number;
  /** Bucket hasn't started yet — its numbers are planned, not banked. (The bucket
   *  containing today counts as started, even though part of it is still ahead.) */
  isFuture: boolean;
}

const parseISO = (iso: string): Date => new Date(iso + 'T00:00:00');
const addDays = (d: Date, n: number): Date => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};
const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) => parseISO(iso).toLocaleDateString(undefined, opts);

/** Shift a YYYY-MM-01 by n months (n may be negative). */
export function shiftMonthStart(monthStart: string, n: number): string {
  const [y, m] = monthStart.split('-').map(Number);
  return toISODate(new Date(y, m - 1 + n, 1));
}

/** Last day of the month containing a YYYY-MM-DD. */
export function endOfMonth(monthStart: string): string {
  const [y, m] = monthStart.split('-').map(Number);
  return toISODate(new Date(y, m, 0));
}

/** Thursday on or before `iso` — weeks run Thursday→Wednesday, so a pay-day
 *  deposit lands on its week's first day. */
function thursdayOnOrBefore(iso: string): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() - ((d.getDay() - 4 + 7) % 7));
  return toISODate(d);
}

/** The [start, end] ranges the trend is plotted over, for one granularity. */
function ranges(
  granularity: SavingsGranularity,
  monthStart: string,
  startMonth: string
): { start: string; end: string }[] {
  const monthEnd = endOfMonth(monthStart);

  if (granularity === 'daily') {
    // Every day of the month in view.
    const out: { start: string; end: string }[] = [];
    for (let d = parseISO(monthStart); toISODate(d) <= monthEnd; d = addDays(d, 1)) {
      const iso = toISODate(d);
      out.push({ start: iso, end: iso });
    }
    return out;
  }

  if (granularity === 'weekly') {
    // The 13 pay weeks ending with the month in view, so the trend has a run-up
    // rather than starting cold on the 1st. Weeks that finish before the account
    // existed are dropped — they'd only draw a flat pre-history.
    const last = thursdayOnOrBefore(monthEnd);
    const out: { start: string; end: string }[] = [];
    for (let i = 12; i >= 0; i--) {
      const start = toISODate(addDays(parseISO(last), -7 * i));
      const end = toISODate(addDays(parseISO(start), 6));
      if (end < startMonth) continue;
      out.push({ start, end });
    }
    return out;
  }

  // The 12 months ending at the month in view, never reaching back past the
  // account's start month.
  const out: { start: string; end: string }[] = [];
  for (let i = 11; i >= 0; i--) {
    const start = shiftMonthStart(monthStart, -i);
    if (start < startMonth) continue;
    out.push({ start, end: endOfMonth(start) });
  }
  return out.length > 0 ? out : [{ start: monthStart, end: monthEnd }];
}

function labelsFor(
  granularity: SavingsGranularity,
  start: string,
  end: string
): { label: string; fullLabel: string } {
  if (granularity === 'daily') {
    return {
      label: String(parseISO(start).getDate()),
      fullLabel: fmt(start, { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  }
  if (granularity === 'weekly') {
    return {
      label: fmt(start, { month: 'short', day: 'numeric' }),
      fullLabel: `${fmt(start, { month: 'short', day: 'numeric' })} – ${fmt(end, { month: 'short', day: 'numeric' })}`,
    };
  }
  return { label: fmt(start, { month: 'short' }), fullLabel: fmt(start, { month: 'long', year: 'numeric' }) };
}

/**
 * Bucket the movements into a running-balance series.
 *
 * `startingBalance` is the balance as of `startMonth`, so every event handed in
 * must be dated on or after it. Movements that fall before the first bucket are
 * still counted — they roll into the opening balance, which is what makes a
 * mid-history window (13 weeks, 12 months) line up with the real balance.
 */
export function buildSavingsBuckets(
  events: SavingsEvent[],
  startingBalance: number,
  granularity: SavingsGranularity,
  monthStart: string,
  startMonth: string,
  todayISO: string
): SavingsBucket[] {
  const spans = ranges(granularity, monthStart, startMonth);
  if (spans.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

  // Everything before the window opens is part of the opening balance.
  let running = startingBalance;
  let i = 0;
  while (i < sorted.length && sorted[i].date < spans[0].start) {
    running += sorted[i].delta;
    i++;
  }

  return spans.map(({ start, end }) => {
    let change = 0;
    while (i < sorted.length && sorted[i].date <= end) {
      change += sorted[i].delta;
      i++;
    }
    running += change;
    return {
      key: end,
      start,
      end,
      ...labelsFor(granularity, start, end),
      change,
      balance: running,
      isFuture: start > todayISO,
    };
  });
}

/** Movements inside a bucket, for the tooltip / detail read-out. */
export function eventsInBucket(events: SavingsEvent[], bucket: SavingsBucket): SavingsEvent[] {
  return events.filter((e) => e.date >= bucket.start && e.date <= bucket.end);
}

/** "$1.2k" / "$840" — compact money for axis ticks, where space is the constraint. */
export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1000) {
    const k = abs / 1000;
    return `${sign}$${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return `${sign}$${Math.round(abs)}`;
}

/** Up to `count` rounded gridline values covering [min, max]. */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!(max > min)) return [min];
  const rawStep = (max - min) / (count - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 0.001; v += step) out.push(Math.round(v * 100) / 100);
  return out.length > 0 ? out : [min, max];
}
