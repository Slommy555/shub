/** Local (not UTC) YYYY-MM-DD for a Date. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** Parse a YYYY-MM-DD string into a local Date (midnight). */
export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function isToday(s: string | null): boolean {
  return !!s && s === todayISO();
}

export function isOverdue(s: string | null): boolean {
  return !!s && s < todayISO();
}

/** Human label for a due date chip: Overdue / Today / Tomorrow / "Mon 8". */
export function formatDue(s: string): string {
  const today = todayISO();
  if (s < today) return 'Overdue';
  if (s === today) return 'Today';
  const tomorrow = toISODate(new Date(Date.now() + 86400000));
  if (s === tomorrow) return 'Tomorrow';
  const d = parseISO(s);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatToday(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
