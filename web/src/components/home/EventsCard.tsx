import { isEvent } from '../../hooks/useReminders';
import { formatTime, todayISO } from '../../lib/dates';
import type { Task } from '../../types';
import { Card, SectionHeader } from './parts';

const MAX_ROWS = 4;

/**
 * Today's timed blocks (tasks with both a start and an end time), earliest
 * first. The whole card is hidden when today has none.
 */
export default function EventsCard({
  tasks,
  onOpenTasks,
}: {
  tasks: Task[];
  onOpenTasks: () => void;
}) {
  const today = todayISO();
  const events = tasks
    .filter((t) => isEvent(t) && (t.scheduled_date ?? t.due_date) === today)
    .sort((a, b) => (a.start_time! < b.start_time! ? -1 : 1));

  if (events.length === 0) return null;

  return (
    <Card>
      <SectionHeader title="Today's Schedule" />
      <div className="flex flex-col">
        {events.slice(0, MAX_ROWS).map((e) => (
          <div key={e.id} className="flex items-baseline gap-3" style={{ minHeight: 36 }}>
            <span
              className="w-20 shrink-0 text-[13px] tabular-nums"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {formatTime(e.start_time!)}
            </span>
            <span
              className="min-w-0 flex-1 truncate text-[15px]"
              style={{
                color: e.done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                textDecoration: e.done ? 'line-through' : 'none',
              }}
            >
              {e.text}
            </span>
          </div>
        ))}
      </div>
      {events.length > MAX_ROWS && (
        <button
          type="button"
          onClick={onOpenTasks}
          className="mt-2 text-[13px] font-medium active:opacity-70"
          style={{ color: 'var(--color-accent)' }}
        >
          View all
        </button>
      )}
    </Card>
  );
}
