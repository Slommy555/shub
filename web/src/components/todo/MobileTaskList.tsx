import { useState } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { PRIORITY_DOT, type Task } from '../../types';
import { addDays, formatShort, formatTimeRange } from '../../lib/dates';
import { listDate } from '../../lib/taskOrder';
import { titleCase } from '../../lib/text';
import { haptic } from '../../lib/native';
import { useApp } from '../../context/AppContext';
import ContextMenu from '../ContextMenu';

interface Props {
  /** The focused day's tasks, already in display order. */
  tasks: Task[];
  /** The day this list represents (ISO), used by paste / move actions. */
  day: string;
  onToggle: (id: string, done: boolean) => void;
}

/** One row: drag to reorder, tap to expand, pencil to edit, ⋯ for more. */
function Row({ task, day, onToggle }: { task: Task; day: string; onToggle: Props['onToggle'] }) {
  const {
    categories,
    openEditTask,
    deleteTask,
    updateTask,
    updateSubtask,
    copyTask,
    cutTask,
    duplicateTask,
    pasteTask,
    hasClipboard,
  } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const subs = task.subtasks ?? [];
  const doneCount = subs.filter((s) => s.done).length;
  const timeRange = formatTimeRange(task.start_time, task.end_time);
  const deadline = task.due_date && task.due_date !== listDate(task) ? task.due_date : null;

  function openMenu(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    setMenu({ x: r.right - 4, y: r.bottom + 4 });
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 40 : undefined,
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      className={[
        'surface overflow-hidden transition-[box-shadow,opacity]',
        isDragging ? 'opacity-80 shadow-pop ring-1 ring-accent-400/60' : '',
        task.done ? 'opacity-55' : '',
      ].join(' ')}
    >
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Edit…', onClick: () => openEditTask(task) },
            { label: 'Copy', onClick: () => copyTask(task) },
            { label: 'Cut', onClick: () => cutTask(task) },
            { label: 'Duplicate here', onClick: () => duplicateTask(task, day) },
            ...(hasClipboard
              ? [{ label: 'Paste into this day', onClick: () => pasteTask(day) }]
              : []),
            {
              label: 'Move to next day',
              onClick: () => updateTask(task.id, { scheduled_date: addDays(day, 1) }),
            },
            {
              label: 'Move to previous day',
              onClick: () => updateTask(task.id, { scheduled_date: addDays(day, -1) }),
            },
            {
              label: 'Unschedule',
              onClick: () => updateTask(task.id, { scheduled_date: null, due_date: null }),
            },
            { label: 'Delete', danger: true, onClick: () => deleteTask(task.id) },
          ]}
        />
      )}

      <div className="flex items-start gap-1 p-2.5">
        {/* Drag handle — large touch target, `touch-none` so the page doesn't
            scroll while dragging a row on a phone. */}
        <button
          type="button"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
          className="-ml-1 grid h-11 w-7 shrink-0 touch-none place-items-center rounded-lg text-gray-300 active:bg-gray-100 dark:text-gray-600 dark:active:bg-gray-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>

        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => {
            if (e.target.checked) haptic();
            onToggle(task.id, e.target.checked);
          }}
          aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
          className="mt-2 h-5 w-5 shrink-0 cursor-pointer rounded-md border-gray-300 focus:ring-accent-400/40 dark:border-gray-600 dark:bg-gray-800"
        />

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 py-1 pl-1.5 text-left"
        >
          <span className="flex items-start gap-1.5">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} />
            <span
              className={[
                'min-w-0 break-words text-[15px] font-medium leading-snug',
                task.done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100',
              ].join(' ')}
            >
              {titleCase(task.text)}
            </span>
          </span>

          <span className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-3.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categories.colorFor(task.category)}`}
            >
              {task.category}
            </span>
            <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {timeRange ?? 'Anytime'}
            </span>
            {deadline && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                due {formatShort(deadline)}
              </span>
            )}
            {subs.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                {doneCount}/{subs.length}
              </span>
            )}
          </span>
        </button>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => openEditTask(task)}
            aria-label="Edit task"
            className="grid h-11 w-9 place-items-center rounded-lg text-gray-400 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={openMenu}
            aria-label="More actions"
            className="grid h-11 w-8 place-items-center rounded-lg text-gray-400 active:bg-gray-100 dark:active:bg-gray-800"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" />
            </svg>
          </button>
        </div>
      </div>

      {expanded && (subs.length > 0 || task.notes?.trim()) && (
        <div className="space-y-2 border-t border-gray-100 px-3 py-2.5 dark:border-gray-800">
          {subs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {subs.map((s) => (
                <label key={s.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => updateSubtask(s.id, { done: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <span
                    className={[
                      'min-w-0 flex-1 break-words text-[13px]',
                      s.done ? 'text-gray-400 line-through' : 'text-gray-600 dark:text-gray-300',
                    ].join(' ')}
                  >
                    {s.text}
                  </span>
                </label>
              ))}
            </div>
          )}
          {task.notes?.trim() && (
            <p className="whitespace-pre-wrap break-words text-[13px] text-gray-500 dark:text-gray-400">
              {task.notes}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The phone "Tasks" pane: the focused day's tasks as a sortable list. Rows can
 * be dragged to reorder (persisted to `position`), edited inline via the pencil,
 * and copied / cut / pasted / duplicated from the ⋯ menu. Lives inside the
 * WeeklyView DndContext so a card can also be dragged onto another day.
 */
export default function MobileTaskList({ tasks, day, onToggle }: Props) {
  const { hasClipboard, pasteTask } = useApp();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </p>
        {hasClipboard && (
          <button
            type="button"
            onClick={() => pasteTask(day)}
            className="inline-flex items-center gap-1.5 rounded-full border border-accent-300/70 bg-accent-50 px-3 py-1.5 text-[11px] font-semibold text-accent-700 active:scale-95 dark:border-accent-700/60 dark:bg-accent-900/40 dark:text-accent-200"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="8" y="2" width="8" height="4" rx="1" />
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
            </svg>
            Paste task
          </button>
        )}
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400 dark:border-gray-800">
          No tasks for this day.
        </p>
      ) : (
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {tasks.map((t) => (
              <Row key={t.id} task={t} day={day} onToggle={onToggle} />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
