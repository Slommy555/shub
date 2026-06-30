import { useEffect, useState } from 'react';
import type { Task } from '../types';
import { eventReminderText, type UpcomingEvent } from '../hooks/useReminders';
import { titleCase } from '../lib/text';

interface Props {
  dueTasks: Task[];
  upcomingEvents: UpcomingEvent[];
  permission: NotificationPermission | 'unsupported';
  onRequestPermission: () => void;
}

/**
 * Non-blocking reminder UI. When browser notifications are granted, the hook
 * fires those; this component additionally shows an in-app toast/banner so the
 * reminder is visible even without OS notifications. Dismissable per session.
 *
 * Timed events (work, meetings, …) get their own "starts in N minutes" banner,
 * separate from the to-do "due today" reminder — an event isn't a task.
 */
export default function DueDateReminder({
  dueTasks,
  upcomingEvents,
  permission,
  onRequestPermission,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Re-show the toast if the set of reminders changes.
  const signature = [
    ...dueTasks.map((t) => t.id),
    ...upcomingEvents.map((e) => `event:${e.task.id}`),
  ].join(',');
  useEffect(() => {
    setDismissed(false);
  }, [signature]);

  if (dismissed || (dueTasks.length === 0 && upcomingEvents.length === 0)) return null;

  const overflow = dueTasks.length - 3;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2 p-4">
      {/* Upcoming event reminders (one per event). */}
      {upcomingEvents.map(({ task, minutesUntil }) => (
        <div
          key={task.id}
          className="pointer-events-auto w-full max-w-app animate-slide-up rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-lg dark:border-blue-500/30 dark:bg-blue-950/80 dark:backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-blue-400/30 text-blue-600 dark:text-blue-300">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-300/80">
                Reminder
              </p>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                {eventReminderText({ ...task, text: titleCase(task.text) }, minutesUntil)}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Due / overdue to-dos. */}
      {dueTasks.length > 0 && (
        <div className="pointer-events-auto w-full max-w-app animate-slide-up rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-lg dark:border-amber-500/30 dark:bg-amber-950/80 dark:backdrop-blur">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-400/30 text-amber-600 dark:text-amber-300">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {dueTasks.length} task{dueTasks.length > 1 ? 's' : ''} due today or overdue
              </p>
              <ul className="mt-1 space-y-0.5 text-sm text-amber-800 dark:text-amber-300/90">
                {dueTasks.slice(0, 3).map((t) => (
                  <li key={t.id} className="truncate">• {t.text}</li>
                ))}
                {overflow > 0 && <li className="text-amber-700/80">+ {overflow} more</li>}
              </ul>

              {permission === 'default' && (
                <button
                  type="button"
                  onClick={onRequestPermission}
                  className="mt-2 text-xs font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300"
                >
                  Enable browser notifications
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-amber-600 hover:bg-amber-400/20 dark:text-amber-300"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
