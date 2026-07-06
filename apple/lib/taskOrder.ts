import type { Task } from './types';
import { todayISO, toISODate, formatDue, parseISO } from './dates';

/**
 * The day a task lists under: its scheduled (completion) date if set, otherwise
 * its hard due date. Mirrors web/src/lib/taskOrder.ts.
 */
export function listDate(task: Task): string | null {
  return task.scheduled_date ?? task.due_date;
}

export interface DaySection {
  /** bucket key: 'overdue' | ISO date | 'none' */
  key: string;
  title: string;
  data: Task[];
}

/**
 * Group tasks into day sections for a multi-day list:
 * Overdue → Today → Tomorrow → each future date → No date.
 * Within a day, incomplete tasks come before completed ones, then by position.
 */
export function buildDaySections(tasks: Task[]): DaySection[] {
  const today = todayISO();
  const tomorrow = toISODate(new Date(Date.now() + 86_400_000));

  const buckets = new Map<string, Task[]>();
  for (const t of tasks) {
    const d = listDate(t);
    const key = d == null ? 'none' : d < today ? 'overdue' : d;
    const arr = buckets.get(key);
    if (arr) arr.push(t);
    else buckets.set(key, [t]);
  }

  const dateKeys = [...buckets.keys()]
    .filter((k) => k !== 'overdue' && k !== 'none')
    .sort();
  const orderedKeys = [
    ...(buckets.has('overdue') ? ['overdue'] : []),
    ...dateKeys,
    ...(buckets.has('none') ? ['none'] : []),
  ];

  const titleFor = (key: string): string => {
    if (key === 'overdue') return 'Overdue';
    if (key === 'none') return 'No date';
    if (key === today) return 'Today';
    if (key === tomorrow) return 'Tomorrow';
    return parseISO(key).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  return orderedKeys.map((key) => ({
    key,
    title: titleFor(key),
    data: (buckets.get(key) ?? []).sort(
      (a, b) => Number(a.done) - Number(b.done) || a.position - b.position
    ),
  }));
}

export { formatDue };
