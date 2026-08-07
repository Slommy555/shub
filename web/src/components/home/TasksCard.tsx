import { isEvent } from '../../hooks/useReminders';
import { addDays, formatShort, todayISO } from '../../lib/dates';
import { listDate } from '../../lib/taskOrder';
import { haptic } from '../../lib/native';
import type { Priority, Task } from '../../types';
import { Card, CheckCircle, SectionHeader } from './parts';

const MAX_ROWS = 5;

const DOT: Record<Priority, string> = {
  high: 'var(--color-danger)',
  med: 'var(--color-warning)',
  low: 'var(--color-success)',
};

/** "Today" for today's date, "3d overdue" for the past, else "Aug 12". */
function dayChip(due: string, today: string): { text: string; overdue: boolean } {
  if (due === today) return { text: 'Today', overdue: false };
  if (due < today) {
    const days = Math.round(
      (new Date(today + 'T00:00:00').getTime() - new Date(due + 'T00:00:00').getTime()) / 86_400_000
    );
    return { text: `${days}d overdue`, overdue: true };
  }
  return { text: formatShort(due), overdue: false };
}

/**
 * What's due today or already late, checkable in place. `onToggle` is the Shell's
 * `updateTask`, i.e. the exact same `useTasks` instance (and `tasks` table) the
 * To-Do tab writes through — one list, two views.
 */
export default function TasksCard({
  tasks,
  onToggle,
  onOpenTasks,
}: {
  tasks: Task[];
  onToggle: (id: string, done: boolean) => void;
  onOpenTasks: () => void;
}) {
  const today = todayISO();
  const tomorrow = addDays(today, 1);

  // A task's day is `listDate` — the day you scheduled it for, falling back to
  // its hard deadline. That's the same rule the To-Do tab lists by, so "set for
  // today" there means "due today" here. Reading `due_date` alone missed every
  // task that was scheduled for today without a deadline.
  // Timed events live in the Schedule card, so they're left out.
  const due = tasks
    .filter((t) => {
      if (t.done || isEvent(t)) return false;
      const day = listDate(t);
      return day !== null && day <= today;
    })
    .sort((a, b) => {
      const da = listDate(a)!;
      const db = listDate(b)!;
      return da === db ? a.position - b.position : da < db ? -1 : 1;
    });

  const shown = due.slice(0, MAX_ROWS);
  const tomorrowCount = tasks.filter((t) => !t.done && !isEvent(t) && listDate(t) === tomorrow).length;

  return (
    <Card>
      <SectionHeader title="Tasks" meta={`${due.length} due`} />

      {shown.length === 0 ? (
        <p className="text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
          No tasks due today
        </p>
      ) : (
        <div className="flex flex-col">
          {shown.map((t) => {
            const chip = dayChip(listDate(t)!, today);
            return (
              <div key={t.id} className="flex items-center gap-2" style={{ minHeight: 40 }}>
                <CheckCircle checked={false} label={t.text} onToggle={() => { haptic(); onToggle(t.id, true); }} />
                <span
                  className="min-w-0 flex-1 truncate text-[15px]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {t.text}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  title={t.priority}
                  style={{ background: DOT[t.priority] }}
                />
                <span
                  className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background: chip.overdue ? '#3a1a1a' : 'var(--color-bg-surface)',
                    color: chip.overdue ? 'var(--color-danger)' : 'var(--color-text-secondary)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {chip.text}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* mt-auto pins the links to the bottom when the card stretches. */}
      <div className="mt-auto flex flex-col items-start">
        {due.length > MAX_ROWS && (
          <button
            type="button"
            onClick={onOpenTasks}
            className="pt-2 text-[13px] font-medium active:opacity-70"
            style={{ color: 'var(--color-accent)' }}
          >
            View {due.length - MAX_ROWS} more
          </button>
        )}

        {tomorrowCount > 0 && (
          <button
            type="button"
            onClick={onOpenTasks}
            className="pt-3 text-left text-[13px] active:opacity-70"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            {tomorrowCount} task{tomorrowCount === 1 ? '' : 's'} scheduled for tomorrow
          </button>
        )}
      </div>
    </Card>
  );
}
