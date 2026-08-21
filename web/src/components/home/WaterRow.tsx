import { useEffect } from 'react';
import { useWaterLogs } from '../../hooks/useWaterLogs';
import { haptic } from '../../lib/native';
import { formatOz } from '../../lib/water';
import type { Habit } from '../../types/habits';
import QuickAddRow from '../water/QuickAddRow';

interface Props {
  userId: string;
  habit: Habit;
  done: boolean;
  onSetDone: (done: boolean) => void;
  /** Tapping the name or the bar goes to the Habits tab. */
  onOpen: () => void;
}

/**
 * The water habit on Home: a line with a mini progress bar, and under it the
 * quick-add buttons — the same editable set as the Focus card, so a button
 * added or changed in either place shows up in both. Custom one-off amounts,
 * undo and history stay on Focus; the name and the bar link there.
 *
 * It runs the same completion sync as the full card, and the two agree because
 * they compute it from the same realtime-backed totals.
 */
export default function WaterRow({ userId, habit, done, onSetDone, onOpen }: Props) {
  const { loading, todayTotal, addLog } = useWaterLogs(userId, habit.id);
  const goal = Number(habit.water_goal_oz) || 0;
  const reached = goal > 0 && todayTotal >= goal;

  const wantDone = reached;
  useEffect(() => {
    if (loading || goal <= 0) return;
    if (wantDone !== done) onSetDone(wantDone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, goal, wantDone, done]);

  const pct = goal > 0 ? Math.min(100, Math.round((todayTotal / goal) * 100)) : 0;

  return (
    <div className="flex flex-col gap-1.5 py-1">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 items-center gap-2.5 text-left"
        style={{ minHeight: 28 }}
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

      {/* Indented to the name, so the pills read as belonging to this habit and
          not to the checkbox rows above and below it. */}
      <QuickAddRow
        userId={userId}
        size="sm"
        disabled={goal <= 0}
        className="pl-[25px]"
        onLog={(oz) => {
          haptic();
          void addLog(oz);
        }}
      />
    </div>
  );
}
