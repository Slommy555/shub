import { arrayMove } from '@dnd-kit/sortable';
import type { Task } from '../types';

/**
 * Reorder the visible subset of tasks while keeping filtered-out tasks pinned
 * in their original slots. Used by the daily view, where only one day's tasks
 * are shown but positions are global.
 */
export function reorderWithinVisible(
  full: Task[],
  visibleIds: string[],
  activeId: string,
  overId: string
): Task[] {
  const oldIndex = visibleIds.indexOf(activeId);
  const newIndex = visibleIds.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return full;

  const newVisibleOrder = arrayMove(visibleIds, oldIndex, newIndex);
  const visibleSet = new Set(visibleIds);
  const byId = new Map(full.map((t) => [t.id, t]));
  const queue = [...newVisibleOrder];

  return full.map((t) => {
    if (!visibleSet.has(t.id)) return t;
    const nextId = queue.shift()!;
    return byId.get(nextId)!;
  });
}

/**
 * The day a task lists under on the calendar: its completion (scheduled) date
 * if set, otherwise its hard due date.
 */
export function listDate(task: Task): string | null {
  return task.scheduled_date ?? task.due_date;
}

/** Group tasks by their list date ('none' when neither date is set). */
export function groupByDay(tasks: Task[]): Map<string, Task[]> {
  const map = new Map<string, Task[]>();
  for (const t of tasks) {
    const key = listDate(t) ?? 'none';
    const arr = map.get(key);
    if (arr) arr.push(t);
    else map.set(key, [t]);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
  return map;
}
