import { useState } from 'react';
import { COLOR_DOT, COLOR_KEYS, type ColorKey } from '../../types';
import type { HabitKind } from '../../types/habits';

interface Props {
  onAdd: (input: { name: string; kind: HabitKind; color: ColorKey }) => void;
}

const KINDS: { id: HabitKind; label: string }[] = [
  { id: 'habit', label: 'Habit' },
  { id: 'goal', label: 'Goal' },
];

/** Inline form to create a new habit or goal. */
export default function AddHabitForm({ onAdd }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HabitKind>('habit');
  const [color, setColor] = useState<ColorKey>('green');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, kind, color });
    setName('');
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'goal' ? 'New daily goal…' : 'New habit…'}
          className="min-w-[12rem] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
        />

        {/* Habit / Goal toggle */}
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              className={[
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                kind === k.id
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {k.label}
            </button>
          ))}
        </div>

        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
        >
          Add
        </button>
      </div>

      {/* Color picker */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Color</span>
        {COLOR_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setColor(key)}
            aria-label={key}
            aria-pressed={color === key}
            className={[
              'h-5 w-5 rounded-full transition-transform',
              COLOR_DOT[key],
              color === key
                ? 'ring-2 ring-gray-800 ring-offset-2 dark:ring-gray-200 dark:ring-offset-gray-900'
                : 'hover:scale-110',
            ].join(' ')}
          />
        ))}
      </div>
    </form>
  );
}
