import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { PRIORITY_DOT, type Task } from '../../types';
import { formatShort, formatTimeRange } from '../../lib/dates';
import { titleCase } from '../../lib/text';
import { listDate } from '../../lib/taskOrder';
import { useApp } from '../../context/AppContext';
import ContextMenu from '../ContextMenu';

/** Compact, draggable task chip used in the weekly and monthly boards. */
export function ScheduleCard({
  task,
  onToggle,
  overlay = false,
  showSubtasks = false,
}: {
  task: Task;
  onToggle: (id: string, done: boolean) => void;
  overlay?: boolean;
  showSubtasks?: boolean;
}) {
  const { categories, openEditTask, deleteTask, updateSubtask, tasks } = useApp();
  // Virtual repeat occurrences point back to their real (base) task; all edits,
  // deletes and toggles act on that base, and the occurrence can't be dragged.
  const isOccurrence = Boolean(task.occurrence_of);
  const baseTask = task.occurrence_of
    ? tasks.find((t) => t.id === task.occurrence_of) ?? task
    : task;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: overlay || isOccurrence,
  });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [expanded, setExpanded] = useState(false);

  const subs = task.subtasks ?? [];
  const doneCount = subs.filter((s) => s.done).length;
  const timeRange = formatTimeRange(task.start_time, task.end_time);
  // Show the hard deadline when it differs from the day this card sits on.
  const deadline = task.due_date && task.due_date !== listDate(task) ? task.due_date : null;
  // Subtasks show inline by default in some boards, or whenever expanded.
  const showSubs = (showSubtasks || expanded) && !overlay && subs.length > 0;
  const showNotes = expanded && !overlay && Boolean(task.notes?.trim());

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      onContextMenu={
        overlay
          ? undefined
          : (e) => {
              e.preventDefault();
              setMenu({ x: e.clientX, y: e.clientY });
            }
      }
      className={[
        'flex flex-col gap-1 rounded-lg border bg-white px-2 py-1.5 text-[13px] shadow-sm dark:bg-gray-900',
        'border-gray-200 dark:border-gray-800',
        task.done ? 'opacity-50' : '',
        !overlay && isDragging ? 'opacity-30' : '',
        overlay ? 'cursor-grabbing shadow-lg ring-1 ring-gray-400' : '',
      ].join(' ')}
    >
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Edit…', onClick: () => openEditTask(baseTask) },
            {
              label: task.done ? 'Mark as not done' : 'Mark as done',
              onClick: () => onToggle(baseTask.id, !task.done),
            },
            {
              label: isOccurrence ? 'Delete series' : 'Delete',
              danger: true,
              onClick: () => deleteTask(baseTask.id),
            },
          ]}
        />
      )}

      {/* Main row */}
      <div className="flex items-center gap-1.5">
        <span className={`h-3 w-1 shrink-0 rounded-full ${categories.dotFor(task.category)}`} title={task.category} />
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => onToggle(baseTask.id, e.target.checked)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
          className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800"
        />
        <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
        <button
          type="button"
          onClick={() => !overlay && setExpanded((v) => !v)}
          className="min-w-0 flex-1 cursor-grab break-words text-left leading-tight active:cursor-grabbing"
          {...listeners}
          {...attributes}
          title={overlay ? task.text : expanded ? 'Click to collapse' : 'Click to expand'}
        >
          <span className={task.done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100'}>
            {titleCase(task.text)}
          </span>
        </button>
        {task.recurrence && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className="shrink-0 text-gray-400"
            aria-label="Repeats"
          >
            <path d="M17 2l4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />
          </svg>
        )}
        {deadline && (
          <span
            className="shrink-0 rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
            title={`Due ${formatShort(deadline)}`}
          >
            due {formatShort(deadline)}
          </span>
        )}
        {!showSubs && subs.length > 0 && (
          <span className="shrink-0 rounded bg-gray-100 px-1 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            {doneCount}/{subs.length}
          </span>
        )}
      </div>

      {/* Time range (or "Anytime" when the task has no time set) */}
      {!overlay && (
        <div className="flex items-center gap-1 pl-2.5 text-[10px] font-medium">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={timeRange ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className={timeRange ? 'text-gray-500 dark:text-gray-400' : 'text-gray-400 dark:text-gray-500'}>
            {timeRange ?? 'Anytime'}
          </span>
        </div>
      )}

      {/* Indented subtasks */}
      {showSubs && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-gray-200 pl-2 dark:border-gray-700">
          {subs.map((s) => (
            <label key={s.id} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={s.done}
                onChange={(e) => updateSubtask(s.id, { done: e.target.checked })}
                onPointerDown={(e) => e.stopPropagation()}
                className="h-3 w-3 shrink-0 cursor-pointer rounded border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800"
              />
              <span
                className={[
                  'min-w-0 flex-1 break-words',
                  s.done ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300',
                ].join(' ')}
                title={s.text}
              >
                {s.text}
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Notes (revealed on expand) */}
      {showNotes && (
        <p className="ml-3 whitespace-pre-wrap break-words border-l border-gray-200 pl-2 text-[12px] text-gray-500 dark:border-gray-700 dark:text-gray-400">
          {task.notes}
        </p>
      )}
    </div>
  );
}

/** A droppable wrapper. `id` becomes the dnd droppable id. */
export function Droppable({
  id,
  className = '',
  overClassName = '',
  children,
}: {
  id: string;
  className?: string;
  overClassName?: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? overClassName : ''}`}>
      {children}
    </div>
  );
}
