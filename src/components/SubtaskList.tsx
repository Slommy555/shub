import { useState } from 'react';
import type { Subtask } from '../types';

interface Props {
  subtasks: Subtask[];
  onAdd: (text: string) => void;
  onToggle: (id: string, done: boolean) => void;
  onDelete: (id: string) => void;
}

export default function SubtaskList({ subtasks, onAdd, onToggle, onDelete }: Props) {
  const [text, setText] = useState('');

  function add() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setText('');
  }

  return (
    <div className="space-y-1.5">
      {subtasks.map((s) => (
        <div key={s.id} className="group flex items-center gap-2">
          <input
            type="checkbox"
            checked={s.done}
            onChange={(e) => onToggle(s.id, e.target.checked)}
            className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800"
          />
          <span
            className={[
              'flex-1 text-sm',
              s.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200',
            ].join(' ')}
          >
            {s.text}
          </span>
          <button
            type="button"
            onClick={() => onDelete(s.id)}
            aria-label="Delete subtask"
            className="grid h-6 w-6 place-items-center rounded text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:text-gray-600 dark:hover:bg-red-500/10"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-0.5">
        <span className="grid h-4 w-4 shrink-0 place-items-center text-gray-300 dark:text-gray-600">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder="Add subtask…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
      </div>
    </div>
  );
}
