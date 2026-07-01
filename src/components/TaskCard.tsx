import { useEffect, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PRIORITY_DOT,
  PRIORITY_LABEL,
  type Subtask,
  type Task,
} from '../types';
import { isDueToday, isOverdue } from '../hooks/useReminders';
import { titleCase } from '../lib/text';
import { useApp } from '../context/AppContext';
import SubtaskList from './SubtaskList';
import ContextMenu from './ContextMenu';

interface Props {
  task: Task;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string, text: string) => void;
  onToggleSubtask: (id: string, done: boolean) => void;
  onDeleteSubtask: (id: string) => void;
}

function formatDue(date: string): string {
  // date is YYYY-MM-DD; render as e.g. "Jun 23"
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TaskCard({
  task,
  onUpdate,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const { categories, openEditTask } = useApp();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(task.text);
  const [draftNotes, setDraftNotes] = useState(task.notes ?? '');
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Keep drafts in sync if the row changes underneath us (e.g. realtime).
  useEffect(() => setDraftText(task.text), [task.text]);
  useEffect(() => setDraftNotes(task.notes ?? ''), [task.notes]);

  function commitText() {
    const trimmed = draftText.trim();
    setEditing(false);
    if (trimmed && trimmed !== task.text) onUpdate(task.id, { text: trimmed });
    else setDraftText(task.text);
  }

  function commitNotes() {
    const next = draftNotes.trim() ? draftNotes : '';
    if (next !== (task.notes ?? '')) onUpdate(task.id, { notes: next || null });
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const doneCount = task.subtasks.filter((s) => s.done).length;
  const overdue = !task.done && isOverdue(task.due_date);
  const dueToday = !task.done && isDueToday(task.due_date);

  return (
    <div
      ref={setNodeRef}
      style={style}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
      className={[
        'rounded-2xl border bg-white shadow-sm transition-[opacity,box-shadow] dark:bg-gray-900',
        isDragging ? 'border-gray-400 shadow-lg' : 'border-gray-200 dark:border-gray-800',
        task.done ? 'opacity-50' : 'opacity-100',
      ].join(' ')}
    >
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Edit…', onClick: () => openEditTask(task) },
            {
              label: task.done ? 'Mark as not done' : 'Mark as done',
              onClick: () => onUpdate(task.id, { done: !task.done }),
            },
            { label: 'Delete', danger: true, onClick: () => onDelete(task.id) },
          ]}
        />
      )}
      <div className="flex items-start gap-1 p-3">
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Drag to reorder"
          className="mt-0.5 cursor-grab touch-none px-1 py-1 text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600 dark:hover:text-gray-400 max-sm:grid max-sm:h-11 max-sm:w-11 max-sm:place-items-center max-sm:px-0 max-sm:py-0"
          {...attributes}
          {...listeners}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.done}
          onChange={(e) => onUpdate(task.id, { done: e.target.checked })}
          aria-label={task.done ? 'Mark as not done' : 'Mark as done'}
          className="mt-1 h-5 w-5 shrink-0 cursor-pointer rounded-md border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800 max-sm:mt-0.5 max-sm:h-6 max-sm:w-6"
        />

        {/* Main content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} title={`${PRIORITY_LABEL[task.priority]} time`} />

            {editing ? (
              <input
                ref={inputRef}
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onBlur={commitText}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitText();
                  if (e.key === 'Escape') {
                    setDraftText(task.text);
                    setEditing(false);
                  }
                }}
                className="flex-1 rounded-md border border-gray-400 bg-white px-2 py-0.5 text-sm outline-none dark:bg-gray-800"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={[
                  'flex-1 text-left text-sm leading-relaxed',
                  task.done ? 'text-gray-400 line-through' : 'text-gray-800 dark:text-gray-100',
                ].join(' ')}
                title="Click to edit"
              >
                {titleCase(task.text)}
              </button>
            )}
          </div>

          {/* Meta row */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-4">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${categories.colorFor(task.category)}`}>
              {task.category}
            </span>

            {task.due_date && (
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[11px] font-medium',
                  overdue
                    ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300'
                    : dueToday
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
                ].join(' ')}
                title={overdue ? 'Overdue' : dueToday ? 'Due today' : 'Deadline'}
              >
                {overdue ? 'Overdue · ' : dueToday ? 'Due today · ' : 'Due '}
                {formatDue(task.due_date)}
              </span>
            )}

            {task.subtasks.length > 0 && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                {doneCount}/{task.subtasks.length} subtasks
              </button>
            )}
          </div>

          {/* Indented subtasks (collapsed view) */}
          {!expanded && task.subtasks.length > 0 && (
            <div className="ml-4 mt-2 flex flex-col gap-1 border-l border-gray-200 pl-3 dark:border-gray-700">
              {task.subtasks.map((s) => (
                <label key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => onToggleSubtask(s.id, e.target.checked)}
                    className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800"
                  />
                  <span
                    className={[
                      'min-w-0 flex-1 truncate text-sm max-sm:overflow-visible max-sm:whitespace-normal max-sm:break-words',
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
        </div>

        {/* Right-side controls */}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 max-sm:h-11 max-sm:w-11"
          >
            <svg
              width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            aria-label="Delete task"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 max-sm:h-11 max-sm:w-11"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expand / collapse region */}
      <div
        className={[
          'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out',
          expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        ].join(' ')}
      >
        <div className="min-h-0">
          <div className="space-y-3 border-t border-gray-100 px-4 py-3 dark:border-gray-800">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Subtasks
              </p>
              <SubtaskList
                subtasks={task.subtasks as Subtask[]}
                onAdd={(text) => onAddSubtask(task.id, text)}
                onToggle={onToggleSubtask}
                onDelete={onDeleteSubtask}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Notes
              </p>
              <textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                onBlur={commitNotes}
                rows={2}
                placeholder="Add notes…"
                className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-800/60"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
