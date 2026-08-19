import { useState } from 'react';
import { COLOR_DOT, COLOR_KEYS, type ColorKey } from '../../types';
import type { HabitKind } from '../../types/habits';

interface Props {
  onAdd: (input: {
    name: string;
    kind: HabitKind;
    color: ColorKey;
    isWater?: boolean;
    waterGoalOz?: number | null;
  }) => void;
  /** Disables the water toggle — there can only be one water habit. */
  hasWaterHabit: boolean;
}

const KINDS: { id: HabitKind; label: string }[] = [
  { id: 'habit', label: 'Habit' },
  { id: 'goal', label: 'Goal' },
];

const DEFAULT_WATER_GOAL = '64';

/** Inline form to create a new habit or goal. */
export default function AddHabitForm({ onAdd, hasWaterHabit }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<HabitKind>('habit');
  const [color, setColor] = useState<ColorKey>('green');
  const [isWater, setIsWater] = useState(false);
  const [goalOz, setGoalOz] = useState(DEFAULT_WATER_GOAL);

  const goal = Number(goalOz);
  const goalValid = Number.isFinite(goal) && goal > 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (isWater && !goalValid) return;
    onAdd({
      name: trimmed,
      kind,
      color,
      isWater,
      waterGoalOz: isWater ? goal : null,
    });
    setName('');
    setIsWater(false);
    setGoalOz(DEFAULT_WATER_GOAL);
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
          placeholder={
            isWater ? 'Water' : kind === 'goal' ? 'New daily goal…' : 'New habit…'
          }
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
          disabled={!name.trim() || (isWater && !goalValid)}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-gray-200 dark:text-gray-900 dark:hover:bg-white"
        >
          Add
        </button>
      </div>

      {/* Water tracking — a habit completed by logging oz, not by a checkbox.
          Only one can exist, so the switch turns off once there is one. */}
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={isWater}
          disabled={hasWaterHabit}
          onClick={() => setIsWater((v) => !v)}
          className="flex items-center gap-2 text-xs font-medium text-gray-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-300"
        >
          <span
            className={[
              'relative h-5 w-9 shrink-0 rounded-full transition-colors',
              isWater ? 'bg-gray-800 dark:bg-gray-200' : 'bg-gray-200 dark:bg-gray-700',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform dark:bg-gray-900',
                isWater ? 'translate-x-[18px]' : 'translate-x-0.5',
              ].join(' ')}
            />
          </span>
          💧 Water tracking
        </button>

        {isWater && (
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Daily goal
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={goalOz}
              onChange={(e) => setGoalOz(e.target.value)}
              aria-label="Daily water goal in ounces"
              className="w-20 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm tabular-nums outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
            />
            oz
          </label>
        )}

        {hasWaterHabit && (
          <span className="text-xs text-gray-400">
            You already have a water tracking habit. Edit the existing one to change your goal.
          </span>
        )}
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
