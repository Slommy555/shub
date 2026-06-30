// Local-time date helpers. Everything is keyed off an ISO date string
// (YYYY-MM-DD) to match the `due_date` column. No timezone math — dates are
// treated as calendar days in the user's local zone.

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(iso: string, n: number): string {
  const d = parseISO(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

const WEEK_STARTS_ON = 0; // Sunday

export function startOfWeek(iso: string): string {
  const d = parseISO(iso);
  const diff = (d.getDay() - WEEK_STARTS_ON + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

/** The 7 ISO dates of the week containing `anchor`. */
export function weekDates(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The Monday on or before `iso` (start of the Monday→Sunday week). */
export function startOfMondayWeek(iso: string): string {
  const d = parseISO(iso);
  const diff = (d.getDay() + 6) % 7; // days since the most recent Monday
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

/** The 7 ISO dates (Monday→Sunday) of the week containing `anchor`. */
export function mondayWeekDates(anchor: string): string[] {
  const start = startOfMondayWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Weeks (arrays of 7 ISO dates) covering the month containing `anchor`. */
export function monthMatrix(anchor: string): string[][] {
  const d = parseISO(anchor);
  const monthIdx = d.getMonth();
  const first = new Date(d.getFullYear(), monthIdx, 1);
  const last = new Date(d.getFullYear(), monthIdx + 1, 0);
  let cur = startOfWeek(toISODate(first));
  const weeks: string[][] = [];
  // Guard against runaway loops; a month spans at most 6 weeks.
  for (let i = 0; i < 6; i++) {
    const week = Array.from({ length: 7 }, (_, j) => addDays(cur, j));
    weeks.push(week);
    if (parseISO(week[6]) >= last) break;
    cur = addDays(cur, 7);
  }
  return weeks;
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}

export function isSameMonth(iso: string, anchor: string): boolean {
  return parseISO(iso).getMonth() === parseISO(anchor).getMonth();
}

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function weekdayShort(iso: string): string {
  return WEEKDAY_LABELS[parseISO(iso).getDay()];
}

export function dayOfMonth(iso: string): number {
  return parseISO(iso).getDate();
}

export function formatDayLong(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShort(iso: string): string {
  return parseISO(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatMonthYear(anchor: string): string {
  return parseISO(anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatWeekRange(anchor: string): string {
  const days = weekDates(anchor);
  return `${formatShort(days[0])} – ${formatShort(days[6])}`;
}

export function formatMondayWeekRange(anchor: string): string {
  const days = mondayWeekDates(anchor);
  return `${formatShort(days[0])} – ${formatShort(days[6])}`;
}

/** "HH:MM" → "9:00 AM". */
export function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "9:00 AM – 10:30 AM" from two "HH:MM" strings, or null if incomplete. */
export function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  return end ? `${formatTime(start)} – ${formatTime(end)}` : formatTime(start);
}
