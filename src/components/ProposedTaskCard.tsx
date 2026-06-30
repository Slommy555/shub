import { useState } from 'react';
import { PRIORITIES, PRIORITY_LABEL, type Priority } from '../types';
import type { ProposedTask } from '../types/voice';
import { useApp } from '../context/AppContext';

interface Props {
  task: ProposedTask;
  onChange: (patch: Partial<ProposedTask>) => void;
  onDelete: () => void;
}

const fieldCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

function UnsureHint({ text }: { text: string }) {
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
        <path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
      <span>{text}</span>
    </p>
  );
}

export default function ProposedTaskCard({ task, onChange, onDelete }: Props) {
  const { categories } = useApp();
  const cats = categories.categories;

  // A timed event shows start/end inputs. Reveal them when Claude proposed a
  // time, asked about one, or the user opts in for a plain task.
  const [showTime, setShowTime] = useState(
    Boolean(task.start_time || task.end_time || task.unsure.start_time || task.unsure.end_time)
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          {/* Task text */}
          <div>
            <input
              value={task.text}
              onChange={(e) => onChange({ text: e.target.value })}
              placeholder="Task description"
              className={fieldCls}
            />
            {task.unsure.text && <UnsureHint text={task.unsure.text} />}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Category */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Category</label>
              <select
                value={task.category}
                onChange={(e) => onChange({ category: e.target.value })}
                className={fieldCls}
              >
                {cats.every((c) => c.name !== task.category) && task.category && (
                  <option value={task.category}>{task.category}</option>
                )}
                {cats.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              {task.unsure.category && <UnsureHint text={task.unsure.category} />}
            </div>

            {/* Time consumption (priority) */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500">Time</label>
              <select
                value={task.priority}
                onChange={(e) => onChange({ priority: e.target.value as Priority })}
                className={fieldCls}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
              {task.unsure.priority && <UnsureHint text={task.unsure.priority} />}
            </div>

            {/* Completion (work) date */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500" title="Day to work on it">
                Do on
              </label>
              <input
                type="date"
                value={task.scheduled_date ?? ''}
                onChange={(e) => onChange({ scheduled_date: e.target.value || null })}
                className={fieldCls}
              />
              {task.unsure.scheduled_date && <UnsureHint text={task.unsure.scheduled_date} />}
            </div>

            {/* Due date (deadline) */}
            <div>
              <label className="mb-1 block text-[11px] font-medium text-gray-500" title="Hard deadline">
                Due
              </label>
              <input
                type="date"
                value={task.due_date ?? ''}
                onChange={(e) => onChange({ due_date: e.target.value || null })}
                className={fieldCls}
              />
              {task.unsure.due_date && <UnsureHint text={task.unsure.due_date} />}
            </div>
          </div>

          {/* Event time range — optional; revealed for timed events */}
          {showTime ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500" title="Event start">
                  Start time
                </label>
                <input
                  type="time"
                  value={task.start_time ?? ''}
                  onChange={(e) => onChange({ start_time: e.target.value || null })}
                  className={fieldCls}
                />
                {task.unsure.start_time && <UnsureHint text={task.unsure.start_time} />}
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-gray-500" title="Event end">
                  End time
                </label>
                <input
                  type="time"
                  value={task.end_time ?? ''}
                  onChange={(e) => onChange({ end_time: e.target.value || null })}
                  className={fieldCls}
                />
                {task.unsure.end_time && <UnsureHint text={task.unsure.end_time} />}
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowTime(false);
                  onChange({ start_time: null, end_time: null });
                }}
                className="col-span-2 text-left text-[11px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                Remove time (make it an untimed task)
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowTime(true)}
              className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
            >
              + Add a time (event)
            </button>
          )}

          {/* Subtasks */}
          <div>
            <label className="mb-1 block text-[11px] font-medium text-gray-500">Subtasks</label>
            <div className="space-y-1.5">
              {task.subtasks.map((s, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-600" />
                  <input
                    value={s}
                    onChange={(e) => {
                      const next = [...task.subtasks];
                      next[i] = e.target.value;
                      onChange({ subtasks: next });
                    }}
                    className={fieldCls}
                  />
                  <button
                    type="button"
                    onClick={() => onChange({ subtasks: task.subtasks.filter((_, j) => j !== i) })}
                    aria-label="Remove subtask"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onChange({ subtasks: [...task.subtasks, ''] })}
                className="text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
              >
                + Add subtask
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove proposed task"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
