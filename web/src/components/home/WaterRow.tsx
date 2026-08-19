import { useEffect, useState } from 'react';
import { useWaterLogs } from '../../hooks/useWaterLogs';
import { haptic } from '../../lib/native';
import { formatOz, loadLastOz, saveLastOz } from '../../lib/water';
import type { Habit } from '../../types/habits';

interface Props {
  userId: string;
  habit: Habit;
  done: boolean;
  onSetDone: (done: boolean) => void;
  /** Tapping anywhere but the quick-add goes to the Habits tab. */
  onOpen: () => void;
}

/**
 * The water habit on Home: one line, a mini progress bar, and a single
 * quick-add for whatever amount was logged last. Everything else about the
 * habit — presets, custom amounts, undo, history — lives on the Focus tab, so
 * the rest of the row is a link there.
 *
 * It runs the same completion sync as the full card, and the two agree because
 * they compute it from the same realtime-backed totals.
 */
export default function WaterRow({ userId, habit, done, onSetDone, onOpen }: Props) {
  const { loading, todayTotal, addLog } = useWaterLogs(userId, habit.id);
  const goal = Number(habit.water_goal_oz) || 0;
  const reached = goal > 0 && todayTotal >= goal;
  // Read once on mount: the amount only changes when this row or the Focus card
  // logs one, and both write it back through `saveLastOz`.
  const [quickOz] = useState(() => loadLastOz(userId));

  const wantDone = reached;
  useEffect(() => {
    if (loading || goal <= 0) return;
    if (wantDone !== done) onSetDone(wantDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, goal, wantDone, done]);

  const pct = goal > 0 ? Math.min(100, Math.round((todayTotal / goal) * 100)) : 0;

  return (
    <div className="flex items-center gap-2" style={{ minHeight: 40 }}>
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
      >
        <span className="shrink-0 text-[15px]">💧</span>
        <span
          className="min-w-0 max-w-[6rem] shrink truncate text-[15px]"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {habit.name}
        </span>
        <span
          className="min-w-[40px] flex-1 overflow-hidden"
          style={{ height: 6, borderRadius: 4, background: 'var(--color-bg-surface)' }}
        >
          <span
            className="block"
            style={{
              width: `${pct}%`,
              height: '100%',
              borderRadius: 4,
              background: reached ? 'var(--color-success)' : 'var(--color-accent)',
              transition: 'width 200ms ease',
            }}
          />
        </span>
        <span
          className="shrink-0 text-[13px] tabular-nums"
          style={{ color: reached ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
        >
          {formatOz(todayTotal)} / {formatOz(goal)} oz
        </span>
      </button>

      <button
        type="button"
        disabled={goal <= 0}
        onClick={() => {
          haptic();
          saveLastOz(userId, quickOz);
          void addLog(quickOz);
        }}
        className="shrink-0 rounded-full px-3 text-[13px] font-semibold tabular-nums active:scale-[0.98] active:opacity-85 disabled:opacity-40"
        style={{
          height: 32,
          background: 'var(--color-accent-subtle)',
          color: 'var(--color-accent)',
        }}
      >
        +{formatOz(quickOz)}oz
      </button>
    </div>
  );
}
