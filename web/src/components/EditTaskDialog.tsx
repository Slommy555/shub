import { useState } from 'react';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  RECURRENCES,
  RECURRENCE_LABEL,
  type Priority,
  type Recurrence,
  type Task,
} from '../types';
import { useApp } from '../context/AppContext';
import SubtaskList from './SubtaskList';

const selectCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

export default function EditTaskDialog({ task, onClose }: { task: Task; onClose: () => void }) {
  const { categories, updateTask, deleteTask, addSubtask, updateSubtask, deleteSubtask } = useApp();
  const cats = categories.categories;

  const [text, setText] = useState(task.text);
  const [category, setCategory] = useState(task.category);
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? '');
  const [completionDate, setCompletionDate] = useState(task.scheduled_date ?? '');
  const [startTime, setStartTime] = useState(task.start_time ?? '');
  const [endTime, setEndTime] = useState(task.end_time ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | ''>(task.recurrence ?? '');
  const [notes, setNotes] = useState(task.notes ?? '');

  function save() {
    const trimmed = text.trim();
    if (!trimmed) return;
    // A timed event needs both ends; otherwise it stays an untimed task.
    const timed = Boolean(startTime && endTime);
    updateTask(task.id, {
      text: trimmed,
      category,
      priority,
      due_date: dueDate || null,
      scheduled_date: completionDate || null,
      start_time: timed ? startTime : null,
      end_time: timed ? endTime : null,
      recurrence: recurrence || null,
      notes: notes.trim() ? notes : null,
    });
    onClose();
  }

  function remove() {
    deleteTask(task.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-gray-200 bg-white p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold tracking-tight">Edit task</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Task</label>
            <input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              className={selectCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={selectCls}>
                {cats.length === 0 && <option value={category}>{category}</option>}
                {cats.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Time consumption</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className={selectCls}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Completion date</label>
              <input
                type="date"
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className={selectCls}
              />
              <p className="mt-1 text-[11px] text-gray-400">Day it lists under.</p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={selectCls}
              />
              <p className="mt-1 text-[11px] text-gray-400">Hard deadline.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Start time</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={selectCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">End time</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={selectCls}
              />
            </div>
            <p className="col-span-2 -mt-1 text-[11px] text-gray-400">
              Set both to show this as a timed block in the Schedule view. Leave blank for an untimed task.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Repeat</label>
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as Recurrence | '')}
              className={selectCls}
            >
              <option value="">Does not repeat</option>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Subtasks</label>
            <SubtaskList
              subtasks={task.subtasks}
              onAdd={(t) => addSubtask(task.id, t)}
              onToggle={(id, done) => updateSubtask(id, { done })}
              onDelete={deleteSubtask}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add notes…"
              className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={remove}
            className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
