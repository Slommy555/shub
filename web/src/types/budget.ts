// Types + helpers for the Budget tab (a single persistent budget).

export type PeriodType = 'weekly' | 'monthly' | 'standalone';

/**
 * The Budget tab is now one persistent budget per user (no weekly/monthly
 * split). Its income lives on a singleton budget_periods row keyed by these
 * fixed bounds so the (user_id, type, start_date) unique index yields one row.
 */
export const STANDALONE_START = '2000-01-01';
export const STANDALONE_END = '2999-12-31';

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
  created_at?: string;
}

export interface BudgetAllocation {
  id: string;
  user_id: string;
  period_id: string;
  group_id: string;
  amount: number;
}

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

/** Monday of the week containing d (weeks run Monday–Sunday). */
function mondayOf(d: Date): Date {
  const day = d.getDay(); // 0=Sun … 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const m = addDays(d, diff);
  m.setHours(0, 0, 0, 0);
  return m;
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
export function periodForCursor(type: PeriodType, cursor: Date): PeriodBounds {
  if (type === 'weekly') {
    const s = mondayOf(cursor);
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
export function shiftCursor(type: PeriodType, cursor: Date, dir: -1 | 1): Date {
  if (type === 'weekly') return addDays(cursor, dir * 7);
  return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
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
