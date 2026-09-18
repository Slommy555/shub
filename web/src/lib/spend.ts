// Helpers for the Spend tab: money formatting, day grouping, and the optional
// daily limit (a per-device preference, so it lives in localStorage).

import { addDays, formatShort, parseISO, todayISO } from './dates';
import type { SpendEntry } from '../types/spend';

const LIMIT_KEY = 'spend.dailyLimit';

/** "$12.40" / "$1,204.00". Amounts are always whole dollars-and-cents. */
export function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parse what someone typed into the amount box. Accepts "12", "12.4", "$12.40"
 * and returns null for anything that isn't a positive amount of money, so the
 * Add button can simply stay disabled.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

/** "2:34 PM" — the wall-clock time an entry was added. */
export function formatEntryTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Today — Jul 7", "Yesterday — Jul 6", or "Mon, Jul 1" further back. */
export function formatDateHeader(iso: string): string {
  const today = todayISO();
  if (iso === today) return `Today — ${formatShort(iso)}`;
  if (iso === addDays(today, -1)) return `Yesterday — ${formatShort(iso)}`;
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** One day's entries plus their total — what the list renders, newest day first. */
export interface SpendDay {
  date: string;
  entries: SpendEntry[];
  total: number;
}

/**
 * Group entries by the day they were spent, newest day first and newest entry
 * first within each day. Days with no entries simply don't appear.
 */
export function groupByDay(entries: SpendEntry[]): SpendDay[] {
  const byDate = new Map<string, SpendEntry[]>();
  for (const e of entries) {
    const list = byDate.get(e.spent_at);
    if (list) list.push(e);
    else byDate.set(e.spent_at, [e]);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, list]) => ({
      date,
      entries: [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
      total: list.reduce((sum, e) => sum + Number(e.amount), 0),
    }));
}

/** Everything spent on one calendar day. */
export function totalForDate(entries: SpendEntry[], iso: string): number {
  return entries.reduce((sum, e) => (e.spent_at === iso ? sum + Number(e.amount) : sum), 0);
}

// --- the optional daily limit ------------------------------------------------

/** The saved daily limit, or null when none is set. */
export function readDailyLimit(): number | null {
  try {
    const raw = localStorage.getItem(LIMIT_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Save a limit, or clear it by passing null. */
export function writeDailyLimit(limit: number | null): void {
  try {
    if (limit == null) localStorage.removeItem(LIMIT_KEY);
    else localStorage.setItem(LIMIT_KEY, String(limit));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
