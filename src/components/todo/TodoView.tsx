import { useState } from 'react';
import type { UseTasks } from '../../hooks/useTasks';
import { useIsMobile } from '../../hooks/useIsMobile';
import {
  addDays,
  addMonths,
  formatDayLong,
  formatMonthYear,
  formatMondayWeekRange,
  todayISO,
} from '../../lib/dates';
import AddTaskForm from '../AddTaskForm';
import WeeklyView from './WeeklyView';
import MonthlyView from './MonthlyView';
import ScheduleView from './ScheduleView';
import { SleepButton, WorkDaysButton } from './SchedulePrefsButtons';

type Mode = 'day' | 'week' | 'month';

const MODES: { id: Mode; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

export default function TodoView({ api }: { api: UseTasks }) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<Mode>('week');
  const [anchor, setAnchor] = useState<string>(todayISO());
  const [showAdd, setShowAdd] = useState(false);
  // Mobile-only: view tasks OR the schedule, one at a time. Defaults to Tasks.
  const [mobilePane, setMobilePane] = useState<'tasks' | 'schedule'>('tasks');

  // Dragging changes the completion (plan) day, not the hard deadline.
  const move = (id: string, day: string | null) => api.updateTask(id, { scheduled_date: day });
  const toggle = (id: string, done: boolean) => api.updateTask(id, { done });

  function step(dir: -1 | 1) {
    if (mode === 'month') setAnchor((a) => addMonths(a, dir));
    else if (mode === 'week') setAnchor((a) => addDays(a, dir * 7));
    else setAnchor((a) => addDays(a, dir));
  }

  const title =
    mode === 'day'
      ? formatDayLong(anchor)
      : mode === 'week'
        ? formatMondayWeekRange(anchor)
        : formatMonthYear(anchor);

  return (
    <div className="pb-fab w-full px-4 py-6 sm:px-6">
      <h1 className="mb-4 text-xl font-bold tracking-tight">To-Do List</h1>

      {/* Toolbar: date nav + add + view switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {/* Upper date cycler — desktop only. On mobile the day view's own
              header/cycler is the single navigator (Fix 4). */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous"
              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            </button>
            <button
              type="button"
              onClick={() => setAnchor(todayISO())}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next"
              className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            aria-label={showAdd ? 'Close add task' : 'Add task'}
            aria-expanded={showAdd}
            title="Add task"
            className={[
              'grid h-8 w-8 place-items-center rounded-lg border transition-colors',
              showAdd
                ? 'border-gray-800 bg-gray-800 text-white'
                : 'border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800',
            ].join(' ')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              className={`transition-transform ${showAdd ? 'rotate-45' : ''}`}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <WorkDaysButton />
          <SleepButton />
          {/* Date-range label — desktop only (Fix 4). */}
          <span className="ml-1 hidden text-sm font-semibold text-gray-700 sm:inline dark:text-gray-200">{title}</span>
        </div>

        {/* Day / Week / Month switcher — desktop only (Fix 4). */}
        <div className="hidden rounded-lg border border-gray-200 p-0.5 sm:inline-flex dark:border-gray-700">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={[
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                mode === m.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {showAdd && (
        <div className="mt-3">
          <AddTaskForm onAdd={api.addTask} />
        </div>
      )}

      {/* Mobile-only Tasks / Schedule segmented toggle, sticky to the top so it
          stays reachable while scrolling (Fix 6). */}
      {isMobile && (
        <div className="sticky top-0 z-30 -mx-4 mt-4 bg-gray-50/95 px-4 py-2 backdrop-blur dark:bg-gray-950/95">
          <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
            {(['tasks', 'schedule'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setMobilePane(p)}
                aria-pressed={mobilePane === p}
                className={[
                  'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors',
                  mobilePane === p
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
                ].join(' ')}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4">
        {api.loading ? (
          <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
        ) : isMobile ? (
          // Mobile always uses the day-focused board; the toggle picks the pane.
          <WeeklyView
            tasks={api.tasks}
            anchor={anchor}
            onMove={move}
            onToggle={toggle}
            onAnchorChange={setAnchor}
            mobilePane={mobilePane}
          />
        ) : mode === 'day' ? (
          <ScheduleView tasks={api.tasks} anchor={anchor} onUpdate={api.updateTask} />
        ) : mode === 'week' ? (
          <WeeklyView tasks={api.tasks} anchor={anchor} onMove={move} onToggle={toggle} onAnchorChange={setAnchor} />
        ) : (
          <MonthlyView tasks={api.tasks} anchor={anchor} onMove={move} onToggle={toggle} />
        )}
      </div>
    </div>
  );
}
