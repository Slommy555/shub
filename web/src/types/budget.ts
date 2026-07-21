// Types + helpers for the Budget tab.

/** A navigable period type. ('standalone' is a legacy DB value, no longer used.) */
export type PeriodType = 'daily' | 'weekly' | 'monthly' | 'standalone';

/** A named, fully-independent budget (Personal, Business, ...). */
export interface Budget {
  id: string;
  user_id: string;
  name: string;
  position: number;
  created_at?: string;
}

export interface BudgetPeriod {
  id: string;
  user_id: string;
  budget_id: string;
  type: PeriodType;
  label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  income: number;
  created_at?: string;
}

export type GroupKind = 'standard' | 'credit_card';

export interface BudgetGroup {
  id: string;
  user_id: string;
  budget_id: string;
  name: string;
  color: string;
  position: number;
  /** true = one recurring amount that repeats every period + scales across
   *  timeframes (uses `amount`). false = entered per period (uses allocations). */
  persistent: boolean;
  /** the shared weekly-base amount, used only when persistent. */
  amount: number;
  /** 'credit_card' groups compute a per-pay-day payment from the fields below. */
  kind: GroupKind;
  /** credit card: total owed, and the pay-off window (start pay date → due date).
   *  The payment per pay day = total ÷ pay days from start through due. cc_weeks
   *  is legacy/unused. */
  cc_total: number;
  cc_weeks: number;
  cc_start_date: string | null; // YYYY-MM-DD (first pay date)
  cc_due_date: string | null; // YYYY-MM-DD (paid off by)
  created_at?: string;
}

/** Per-period amount for a group. Amounts are ISOLATED per period. */
export interface BudgetAllocation {
  id: string;
  user_id: string;
  period_id: string;
  group_id: string;
  amount: number;
}

/** A pool of set-aside money for one (budget, period). */
export interface SavingsPool {
  id: string;
  user_id: string;
  budget_id: string;
  period_id: string;
  total_saved: number;
}

/** How much of a savings pool is earmarked toward a group. */
export interface SavingsEarmark {
  id: string;
  user_id: string;
  pool_id: string;
  group_id: string;
  amount: number;
}

// --- timeframes -------------------------------------------------------------
// Daily / Weekly / Monthly are navigable period lenses. PER-WEEK items are
// entered per period and isolated (the month sums its weeks). PERSISTENT items
// hold one recurring weekly-base amount that repeats every period and scales
// across timeframes: daily = weekly ÷ 7, monthly = weekly × 4.
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

/** A persistent group's weekly-base amount → the amount shown in this timeframe. */
export const toView = (canonical: number, tf: Timeframe): number => canonical * TIMEFRAME_FACTOR[tf];

/** An amount typed in this timeframe → the weekly-base amount stored on the group. */
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

// --- savings offset (order-independent) -------------------------------------
/**
 * The single source of truth for how a savings earmark offsets a group's cost.
 * Purely a function of the current stored values, so it gives the same result
 * regardless of whether the group amount or the earmark was entered first.
 * `net` = what income must still cover; `covered` = fully paid by savings.
 */
export function savingsOffset(gross: number, earmark: number): { net: number; covered: boolean } {
  const g = Number(gross) || 0;
  const e = Math.max(0, Number(earmark) || 0);
  return { net: Math.max(0, g - e), covered: g > 0 && e >= g };
}

/** Convenience: just the net amount income must cover. */
export const netAmount = (gross: number, earmark: number): number => savingsOffset(gross, earmark).net;

// --- scheduled expenses + credit cards (Round 2) ----------------------------
export interface ScheduledExpense {
  id: string;
  user_id: string;
  budget_id: string;
  name: string;
  amount: number;
  due_month: string; // YYYY-MM-01 (month grouping)
  due_date?: string | null; // YYYY-MM-DD — the specific pay-day Thursday, if chosen
  created_at?: string;
}

export interface CreditCard {
  id: string;
  user_id: string;
  budget_id: string;
  name: string;
  weekly_payment: number;
  position: number;
  created_at?: string;
}

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

/**
 * Every Thursday (as YYYY-MM-DD) whose date falls within the calendar month of
 * `monthStartISO` (a 'YYYY-MM-01' string). These are exactly the weekly periods
 * that roll up into that month — a week belongs to the month containing its
 * Thursday. Used so the monthly roll-up counts each week once and ignores any
 * legacy non-Thursday week rows.
 */
export function thursdaysInMonth(monthStartISO: string): string[] {
  const [y, m] = monthStartISO.split('-').map(Number);
  const last = new Date(y, m, 0); // last day of the month
  const d = new Date(y, m - 1, 1); // first day of the month
  d.setDate(d.getDate() + ((4 - d.getDay() + 7) % 7)); // advance to first Thursday
  const out: string[] = [];
  while (d <= last) {
    out.push(toISODate(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

/**
 * The pay Thursdays whose INCOME counts toward a month, normalised to 4 pay
 * periods. A month keeps its first four Thursdays; a 5th Thursday overflows into
 * the next month's income. So a month's income = its own first four Thursdays +
 * the previous month's overflow 5th (when the previous month had five). This
 * only reassigns income dollars — group amounts still sum by calendar month.
 */
export function payThursdaysForMonth(monthStartISO: string): string[] {
  const own = thursdaysInMonth(monthStartISO);
  const counted = own.slice(0, 4); // this month keeps at most its first four
  const [y, m] = monthStartISO.split('-').map(Number);
  const prev = new Date(y, m - 2, 1); // first day of the previous month (handles Jan→Dec)
  const prevThursdays = thursdaysInMonth(toISODate(new Date(prev.getFullYear(), prev.getMonth(), 1)));
  if (prevThursdays.length >= 5) counted.push(prevThursdays[4]); // carried-in overflow
  return counted;
}

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
    // Label the week by its Thursday — the day that decides which month it rolls
    // up into (Thursday in July → counts for July; in August → August).
    return {
      start_date: toISODate(s),
      end_date: toISODate(e),
      label: s.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
    };
  }
  const s = firstOfMonth(cursor);
  const e = lastOfMonth(cursor);
  return {
    start_date: toISODate(s),
    end_date: toISODate(e),
    label: s.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
  };
}

// --- credit-card payoff -----------------------------------------------------
/** Legacy: weekly payment from a week count. Kept for backward compatibility. */
export const creditCardWeekly = (total: number, weeks: number): number =>
  weeks > 0 ? (Number(total) || 0) / weeks : 0;

/** The pay-day Thursdays (ISO) from the start pay date's week through the due
 *  date's week, inclusive — the window over which the balance is paid off. */
function payoffWindowThursdays(startISO: string | null, dueISO: string | null): Set<string> {
  const set = new Set<string>();
  if (!startISO || !dueISO) return set;
  const [sy, sm, sd] = startISO.split('-').map(Number);
  const [dy, dm, dd] = dueISO.split('-').map(Number);
  const start = thursdayOf(new Date(sy, sm - 1, sd));
  const end = thursdayOf(new Date(dy, dm - 1, dd));
  if (start > end) return set;
  let thu = start;
  while (thu <= end) {
    set.add(toISODate(thu));
    thu = addDays(thu, 7);
  }
  return set;
}

/** The payment due each pay date: balance ÷ number of pay dates in the window. */
export function creditCardPayment(
  cc: { cc_total: number; cc_start_date: string | null; cc_due_date: string | null }
): number {
  const window = payoffWindowThursdays(cc.cc_start_date, cc.cc_due_date);
  if (window.size === 0) return 0;
  return (Number(cc.cc_total) || 0) / window.size;
}

/**
 * A credit-card group's amount for a given period: the per-pay-date payment
 * counted only within its payoff window (start pay date → due date). Outside the
 * window it is $0 — so it stops once the card is paid off. Weekly → the payment
 * if this week is in the window; daily → payment ÷ 7; monthly → payment ×
 * (window Thursdays that fall in the month).
 */
export function creditCardAmountForPeriod(
  cc: { cc_total: number; cc_start_date: string | null; cc_due_date: string | null },
  type: Timeframe,
  bounds: PeriodBounds
): number {
  const window = payoffWindowThursdays(cc.cc_start_date, cc.cc_due_date);
  if (window.size === 0) return 0;
  const payment = (Number(cc.cc_total) || 0) / window.size;
  if (payment <= 0) return 0;

  if (type === 'weekly') return window.has(bounds.start_date) ? payment : 0;
  if (type === 'daily') {
    const [y, m, d] = bounds.start_date.split('-').map(Number);
    const thu = toISODate(thursdayOf(new Date(y, m - 1, d)));
    return window.has(thu) ? payment / 7 : 0;
  }
  // monthly: count the month's Thursdays that fall in the payoff window
  const count = thursdaysInMonth(bounds.start_date).filter((t) => window.has(t)).length;
  return count * payment;
}

/** Move the cursor one period earlier (-1) or later (+1). */
export function shiftCursor(type: Timeframe, cursor: Date, dir: -1 | 1): Date {
  if (type === 'daily') return addDays(cursor, dir);
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
