import type { Task } from '../types';
import { parseISO } from './dates';
import { listDate } from './taskOrder';

/** Does a recurring `task` (with base day `baseISO`) also fall on `dateISO`? */
function occursOn(task: Task, baseISO: string, dateISO: string): boolean {
  if (dateISO <= baseISO) return false; // occurrences only go forward from the base day
  const base = parseISO(baseISO);
  const d = parseISO(dateISO);
  switch (task.recurrence) {
    case 'daily':
      return true;
    case 'weekdays': {
      const wd = d.getDay();
      return wd >= 1 && wd <= 5;
    }
    case 'weekly':
      return d.getDay() === base.getDay();
    case 'monthly':
      return d.getDate() === base.getDate();
    default:
      return false;
  }
}

/**
 * Expand recurring tasks into virtual occurrences for the given visible dates.
 * The real task still lists on its base day; extra matching days get a virtual
 * copy whose id is `${baseId}::${date}` and which carries `occurrence_of`.
 */
export function expandTasks(tasks: Task[], dates: string[]): Task[] {
  const out = [...tasks];
  for (const t of tasks) {
    if (!t.recurrence) continue;
    const baseISO = listDate(t);
    if (!baseISO) continue;
    for (const date of dates) {
      if (date === baseISO) continue;
      if (occursOn(t, baseISO, date)) {
        out.push({
          ...t,
          id: `${t.id}::${date}`,
          scheduled_date: date,
          due_date: null,
          occurrence_of: t.id,
        });
      }
    }
  }
  return out;
}
