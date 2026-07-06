// Small shared helpers for the Budget Tracker UI.

/** Format a number as currency with the user's symbol, e.g. "$1,240.50". */
export function formatMoney(amount: number, symbol = '$'): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const s = abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${symbol}${s}`;
}

/** Compact currency for chart axes/labels, e.g. "$1.2k". */
export function formatMoneyShort(amount: number, symbol = '$'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
  return `${sign}${symbol}${Math.round(abs)}`;
}

/** "2026-07" → "July 2026". */
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** Shift a YYYY-MM month string by n months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const todayLocalISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** "2026-07-03" → "Thu, Jul 3". */
export function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Days remaining until a target date (negative if past). */
export function daysUntil(targetISO: string): number {
  const [y, m, d] = targetISO.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}
