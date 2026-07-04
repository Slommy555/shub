import { useEffect, useRef, useState } from 'react';
import { COLOR_DOT, COLOR_KEYS, type ColorKey } from '../../types';
import type { Habit } from '../../types/habits';
import { completionRate, currentStreak, longestStreak, recentDays } from '../../lib/habits';
import { parseISO } from '../../lib/dates';
import { haptic } from '../../lib/native';

interface Props {
  habit: Habit;
  done: Set<string>;
  today: string;
  onToggle: (date: string) => void;
  onChangeColor: (color: ColorKey) => void;
  onDelete: () => void;
}

const STRIP_DAYS = 14;

/** A single habit/goal row: today's check, consistency stats, recent history. */
export default function HabitCard({ habit, done, today, onToggle, onChangeColor, onDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const doneToday = done.has(today);
  const streak = currentStreak(done, today);
  const best = longestStreak(done);
  const rate = Math.round(completionRate(done, today, habit.created_at.slice(0, 10)) * 100);
  const days = recentDays(today, STRIP_DAYS);
  const dot = COLOR_DOT[habit.color];

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      {/* Today's check */}
      <button
        type="button"
        onClick={() => {
          haptic();
          onToggle(today);
        }}
        aria-pressed={doneToday}
        aria-label={doneToday ? `Mark ${habit.name} not done today` : `Mark ${habit.name} done today`}
        className={[
          'grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 transition-colors',
          doneToday
            ? `${dot} border-transparent text-white`
            : 'border-gray-300 text-transparent hover:border-gray-400 dark:border-gray-600',
        ].join(' ')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </button>

      {/* Name + stats */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100 max-sm:overflow-visible max-sm:whitespace-normal max-sm:break-words">
            {habit.name}
          </p>
          <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-700">
            {habit.kind}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
          <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-200">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-orange-500">
              <path d="M12 2c.5 3-1.5 4.5-2.5 6S8 11 9 12c.5-2 2-2.5 2-2.5-.5 2.5 2 3 2 5a3 3 0 1 1-6 0c0-2.5 2-3.5 1-6.5C12 4 12 2 12 2z" />
            </svg>
            {streak} day{streak === 1 ? '' : 's'}
          </span>
          <span>Best {best}</span>
          <span>{rate}% · 30d</span>
        </div>

        {/* Recent history strip (click a day to toggle it) */}
        <div className="mt-2 flex items-center gap-1">
          {days.map((d) => {
            const isDone = done.has(d);
            const isToday = d === today;
            return (
              <button
                key={d}
                type="button"
                onClick={() => onToggle(d)}
                title={`${parseISO(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${isDone ? ' · done' : ''}`}
                aria-label={d}
                className={[
                  'h-3.5 w-3.5 rounded-[4px] transition-transform hover:scale-125',
                  isDone ? dot : 'bg-gray-200 dark:bg-gray-700',
                  isToday ? 'ring-1 ring-gray-400 ring-offset-1 dark:ring-offset-gray-900' : '',
                ].join(' ')}
              />
            );
          })}
        </div>
      </div>

      {/* Menu */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Habit options"
          className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 max-sm:h-11 max-sm:w-11"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
              Color
            </p>
            <div className="flex flex-wrap gap-1.5 px-1">
              {COLOR_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    onChangeColor(key);
                    setMenuOpen(false);
                  }}
                  aria-label={key}
                  className={[
                    'h-5 w-5 rounded-full transition-transform hover:scale-110',
                    COLOR_DOT[key],
                    habit.color === key ? 'ring-2 ring-gray-800 ring-offset-1 dark:ring-gray-200 dark:ring-offset-gray-900' : '',
                  ].join(' ')}
                />
              ))}
            </div>
            <div className="my-1.5 border-t border-gray-100 dark:border-gray-800" />
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              </svg>
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
