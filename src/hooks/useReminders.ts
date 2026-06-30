import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Task } from '../types';

/** Local YYYY-MM-DD for "today" (avoids UTC off-by-one from toISOString). */
function todayStr(): string {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate < todayStr();
}

export function isDueToday(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return dueDate === todayStr();
}

const CHECK_INTERVAL_MS = 60_000;
/** How long before a timed event starts we begin reminding about it. */
const EVENT_LEAD_MIN = 30;

type Permission = NotificationPermission | 'unsupported';

/** A timed event = a task with both a start and end time (work, meetings, …). */
export function isEvent(task: Task): boolean {
  return !!task.start_time && !!task.end_time;
}

/** "HH:MM" → minutes since midnight. */
function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** A timed event that's coming up soon today, with minutes until it starts. */
export interface UpcomingEvent {
  task: Task;
  minutesUntil: number;
}

/**
 * Surfaces two kinds of reminders, re-checked on a 60s interval:
 *  - `dueTasks`: plain to-dos (not timed events) due today or overdue, not done.
 *  - `upcomingEvents`: timed events scheduled for today that start within the
 *    next 30 minutes — these read as "X starts in N minutes!" rather than a
 *    task reminder, since an event isn't a task to check off.
 * Fires browser notifications when permission is granted; the returned lists
 * also drive in-app banners.
 */
export function useReminders(tasks: Task[]) {
  const [permission, setPermission] = useState<Permission>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );
  // Bumped every interval tick so the memo below recomputes against the clock.
  const [tick, setTick] = useState(0);
  // Tracks which task ids we've already notified about this session, so we
  // don't re-fire the same browser notification every minute.
  const [notified, setNotified] = useState<Set<string>>(new Set());

  const requestPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  // Plain to-dos due today or overdue — timed events are handled separately.
  const dueTasks = useMemo(() => {
    // `tick` is an intentional dependency: it forces a recompute on the timer.
    void tick;
    return tasks.filter(
      (t) => !t.done && !isEvent(t) && (isOverdue(t.due_date) || isDueToday(t.due_date))
    );
  }, [tasks, tick]);

  // Timed events scheduled for today that start within the lead window.
  const upcomingEvents = useMemo<UpcomingEvent[]>(() => {
    void tick;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const today = todayStr();
    return tasks
      .filter((t) => !t.done && isEvent(t) && (t.scheduled_date ?? t.due_date) === today)
      .map((t) => ({ task: t, minutesUntil: toMin(t.start_time!) - nowMin }))
      .filter((e) => e.minutesUntil >= 0 && e.minutesUntil <= EVENT_LEAD_MIN)
      .sort((a, b) => a.minutesUntil - b.minutesUntil);
  }, [tasks, tick]);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Fire browser notifications for newly-due tasks (when allowed).
  useEffect(() => {
    if (permission !== 'granted' || dueTasks.length === 0) return;

    const fresh = dueTasks.filter((t) => !notified.has(t.id));
    if (fresh.length === 0) return;

    const title = fresh.length === 1 ? 'Task due' : `${fresh.length} tasks due`;
    const body = fresh.map((t) => `• ${t.text}`).join('\n');
    try {
      new Notification(title, { body, tag: 'todo-reminders' });
    } catch {
      /* some environments block construction; the in-app banner still shows */
    }

    setNotified((prev) => {
      const next = new Set(prev);
      fresh.forEach((t) => next.add(t.id));
      return next;
    });
  }, [dueTasks, permission, notified]);

  // Fire an event-style notification when a timed event is coming up.
  useEffect(() => {
    if (permission !== 'granted' || upcomingEvents.length === 0) return;

    // Key on the event id so we remind once as it enters the lead window.
    const fresh = upcomingEvents.filter((e) => !notified.has(`event:${e.task.id}`));
    if (fresh.length === 0) return;

    for (const { task, minutesUntil } of fresh) {
      try {
        new Notification('Reminder', { body: eventReminderText(task, minutesUntil), tag: `event-${task.id}` });
      } catch {
        /* some environments block construction; the in-app banner still shows */
      }
    }

    setNotified((prev) => {
      const next = new Set(prev);
      fresh.forEach((e) => next.add(`event:${e.task.id}`));
      return next;
    });
  }, [upcomingEvents, permission, notified]);

  return { dueTasks, upcomingEvents, permission, requestPermission };
}

/** "Work starts in 30 minutes!" / "Work starts now!" */
export function eventReminderText(task: Task, minutesUntil: number): string {
  if (minutesUntil <= 0) return `${task.text} starts now!`;
  const unit = minutesUntil === 1 ? 'minute' : 'minutes';
  return `${task.text} starts in ${minutesUntil} ${unit}!`;
}
