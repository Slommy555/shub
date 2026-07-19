// Types + helpers for the Budget tab.

/** A navigable period type. ('standalone' is a legacy DB value, no longer used.) */
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'standalone';

export interface BudgetPeriod {
  id: string;
  user_id: string;
  type: PeriodType;
  label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  income: number;
  created_at?: string;
}

export interface BudgetGroup {
  id: string;
  user_id: string;
  name: string;
  color: string;
  position: number;
  /** true = repeats every period + scales across timeframes (uses `amount`). */
  persistent: boolean;
  /** the shared weekly-base amount, used only when persistent. */
  amount: number;
  created_at?: string;
}

export interface BudgetAllocation {
  id: string;
  user_id: string;
  period_id: string;
  group_id: string;
  amount: number;
}

// --- timeframes -------------------------------------------------------------
// Daily / Weekly / Monthly are three VIEWS of the same expense, not separate
// data. Every amount + income is stored once at a weekly base and scaled for
// display; editing any timeframe converts back to the weekly base. Chain:
// daily ×7 = weekly, weekly ×4 = monthly (so daily ×28 = monthly).
export type Timeframe = 'daily' | 'weekly' | 'monthly';

export const TIMEFRAMES: Timeframe[] = ['daily', 'weekly', 'monthly'];

export const TIMEFRAME_FACTOR: Record<Timeframe, number> = {
  daily: 1 / 7,
  weekly: 1,
  monthly: 4,
};

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

/** Weekly-base canonical value → the amount shown in the selected timeframe. */
export const toView = (canonical: number, tf: Timeframe): number => canonical * TIMEFRAME_FACTOR[tf];

/** Amount typed in the selected timeframe → weekly-base canonical for storage. */
export const fromView = (value: number, tf: Timeframe): number => value / TIMEFRAME_FACTOR[tf];

/** Tap-to-pick swatches for new groups (no full color wheel). */
export const PRESET_COLORS = [
  '#e05c5c',
  '#f0a04b',
  '#f5e642',
  '#4caf82',
  '#5c9eff',
  '#b8a9f5',
  '#f572b8',
  '#8b8aa8',
] as const;

// --- date helpers -----------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, '0');

/** Local YYYY-MM-DD (avoids the UTC off-by-one from toISOString). */
export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

/** Thursday of the week containing d (weeks run Thursday–Wednesday). */
function thursdayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun … 6=Sat; 4=Thu
  const diff = -((day - 4 + 7) % 7); // step back to the most recent Thursday
  const t = addDays(d, diff);
  t.setHours(0, 0, 0, 0);
  return t;
}

const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const lastOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const shortDate = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export interface PeriodBounds {
  start_date: string;
  end_date: string;
  label: string;
}

/** Derive the period bounds + display label from a cursor date and type. */
export function periodForCursor(type: Timeframe, cursor: Date): PeriodBounds {
  if (type === 'daily') {
    const s = new Date(cursor);
    s.setHours(0, 0, 0, 0);
    const iso = toISODate(s);
    return {
      start_date: iso,
      end_date: iso,
      label: s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  }
  if (type === 'weekly') {
    const s = thursdayOf(cursor);
    const e = addDays(s, 6);
    return { start_date: toISODate(s), end_date: toISODate(e), label: `${shortDate(s)} – ${shortDate(e)}` };
  }
  const s = firstOfMonth(cursor);
  const e = lastOfMonth(cursor);
  return {
    start_date: toISODate(s),
    end_date: toISODate(e),
    label: s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

/** Move the cursor one period earlier (-1) or later (+1). */
export function shiftCursor(type: Timeframe, cursor: Date, dir: -1 | 1): Date {
  if (type === 'daily') return addDays(cursor, dir);
  if (type === 'weekly') return addDays(cursor, dir * 7);
  return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
}

/** Whole days left in `from`'s month, counting `from` itself (min 1). */
export function daysRemainingInMonth(from: Date): number {
  return Math.max(1, lastOfMonth(from).getDate() - from.getDate() + 1);
}

/** Whole weeks left in `from`'s month (ceil of remaining days ÷ 7, min 1). */
export function weeksRemainingInMonth(from: Date): number {
  return Math.max(1, Math.ceil(daysRemainingInMonth(from) / 7));
}

/**
 * Divisor that spreads a non-persistent monthly balance into the selected
 * timeframe, counting remaining time in `from`'s month from `from` onward.
 * Monthly shows the full balance (÷1).
 */
export function spreadDivisor(type: Timeframe, from: Date): number {
  if (type === 'daily') return daysRemainingInMonth(from);
  if (type === 'weekly') return weeksRemainingInMonth(from);
  return 1;
}

// --- money ------------------------------------------------------------------
/** "$1,240" or "$1,240.50" — cents shown only when the value has a fraction. */
export function formatMoney(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const hasFraction = Math.round(v * 100) % 100 !== 0;
  return v.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Parse a loosely-typed money string ("$1,234.5") into a number. */
export function parseMoney(input: string): number {
  const cleaned = input.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}
