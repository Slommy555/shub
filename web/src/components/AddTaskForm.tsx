import { useEffect, useState } from 'react';
import {
  PRIORITIES,
  PRIORITY_LABEL,
  RECURRENCES,
  RECURRENCE_LABEL,
  type Category,
  type Priority,
  type Recurrence,
} from '../types';
import { useApp } from '../context/AppContext';

interface Props {
  onAdd: (input: {
    text: string;
    category: Category;
    priority: Priority;
    due_date: string | null;
    scheduled_date?: string | null;
    recurrence?: Recurrence | null;
  }) => void;
  /** Optional default due date (e.g. the day being viewed). */
  defaultDue?: string;
}

export default function AddTaskForm({ onAdd, defaultDue }: Props) {
  const { categories } = useApp();
  const cats = categories.categories;

  const [text, setText] = useState('');
  const [category, setCategory] = useState<Category>('');
  const [priority, setPriority] = useState<Priority>('med');
  const [dueDate, setDueDate] = useState('');
  const [completionDate, setCompletionDate] = useState(defaultDue ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | ''>('');

  // Default the category to the first available once categories load.
  useEffect(() => {
    if (!category && cats.length > 0) setCategory(cats[0].name);
  }, [cats, category]);

  useEffect(() => {
    setCompletionDate(defaultDue ?? '');
  }, [defaultDue]);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd({
      text: trimmed,
      category: category || (cats[0]?.name ?? 'other'),
      priority,
      due_date: dueDate || null,
      scheduled_date: completionDate || null,
      recurrence: recurrence || null,
    });
    setText('');
    setDueDate('');
    setCompletionDate(defaultDue ?? '');
    setRecurrence('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  const selectCls =
    'rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-900';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a task…"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={submit}
          aria-label="Add task"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gray-800 text-white transition-colors hover:bg-gray-700"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={selectCls}
          aria-label="Category"
        >
          {cats.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as Priority)}
          className={selectCls}
          aria-label="Time consumption"
        >
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]} time
            </option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-xs text-gray-400" title="Day you plan to work on it (lists under this day)">
          Do
          <input
            type="date"
            value={completionDate}
            onChange={(e) => setCompletionDate(e.target.value)}
            className={selectCls}
            aria-label="Completion date (day to work on it)"
          />
        </label>

        <label className="flex items-center gap-1 text-xs text-gray-400" title="Hard deadline (e.g. Canvas due date)">
          Due
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className={selectCls}
            aria-label="Due date (deadline)"
          />
        </label>

        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Recurrence | '')}
          className={selectCls}
          aria-label="Repeat"
          title="Repeat"
        >
          <option value="">No repeat</option>
          {RECURRENCES.map((r) => (
            <option key={r} value={r}>
              {RECURRENCE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
