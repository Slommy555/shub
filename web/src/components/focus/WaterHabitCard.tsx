import { useEffect, useState } from 'react';
import { useWaterLogs } from '../../hooks/useWaterLogs';
import { haptic } from '../../lib/native';
import { formatLogTime, formatOz } from '../../lib/water';
import type { Habit } from '../../types/habits';
import QuickAddRow from '../water/QuickAddRow';
import WaterHistoryChart from './WaterHistoryChart';

interface Props {
  userId: string;
  habit: Habit;
  /** Whether the habit's completion row exists for today. */
  done: boolean;
  /** Idempotent — the card calls this whenever the day's total crosses the goal. */
  onSetDone: (done: boolean) => void;
  onEditGoal: (goalOz: number) => void;
  onDelete: () => void;
}

/**
 * The water habit: a progress bar over the day's oz, quick-add buttons, and a
 * 7-day history. Unlike every other habit it has no checkbox — completion is
 * derived from the oz logged, so the card writes the `habit_logs` row itself
 * (via `onSetDone`) the moment the total reaches the goal, and takes it back if
 * an Undo drops the day below it again.
 *
 * The quick-add buttons are `QuickAddRow`, shared with the Home water row, so
 * editing them in either place changes both.
 */
export default function WaterHabitCard({
  userId,
  habit,
  done,
  onSetDone,
  onEditGoal,
  onDelete,
}: Props) {
  const { loading, todayTotal, lastToday, history, addLog, undoLast } = useWaterLogs(
    userId,
    habit.id
  );
  const goal = Number(habit.water_goal_oz) || 0;
  const reached = goal > 0 && todayTotal >= goal;

  const [customOpen, setCustomOpen] = useState(false);
  const [customOz, setCustomOz] = useState('');
  const [goalDraft, setGoalDraft] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);

  // Keep the habit's completion row in step with the day's total. Waiting for
  // the load means an empty in-flight `logs` can't un-tick an already-done day.
  const wantDone = reached;
  useEffect(() => {
    if (loading || goal <= 0) return;
    if (wantDone !== done) onSetDone(wantDone);
    // onSetDone is recreated on every logs change upstream; depending on it here
    // would re-fire this effect constantly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, goal, wantDone, done]);

  function log(oz: number, label: string | null = null) {
    haptic();
    void addLog(oz, label);
  }

  function submitCustom() {
    const oz = Number(customOz);
    if (!Number.isFinite(oz) || oz <= 0) return;
    log(oz, 'custom');
    setCustomOz('');
    setCustomOpen(false);
  }

  function commitGoal() {
    const oz = Number(goalDraft);
    if (Number.isFinite(oz) && oz > 0 && oz !== goal) onEditGoal(oz);
    setEditingGoal(false);
  }

  const pct = goal > 0 ? Math.min(100, Math.round((todayTotal / goal) * 100)) : 0;
  const fill = reached ? 'var(--color-success)' : 'var(--color-accent)';

  return (
    <div
      className="ui-scope flex flex-col border p-4"
      style={{
        background: 'var(--color-bg-elevated)',
        borderColor: 'var(--color-border)',
        borderRadius: 16,
      }}
    >
      {/* Header: name + today's total */}
      <div className="flex items-baseline justify-between gap-3">
        <span
          className="min-w-0 truncate text-[17px] font-medium"
          style={{ color: 'var(--color-text-primary)' }}
        >
          💧 {habit.name}
        </span>
        {editingGoal ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={goalDraft}
              onChange={(e) => setGoalDraft(e.target.value)}
              onBlur={commitGoal}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitGoal();
                if (e.key === 'Escape') setEditingGoal(false);
              }}
              aria-label="Daily water goal in ounces"
              className="w-16 rounded-xl border px-2 py-1 text-right text-[15px] tabular-nums outline-none"
              style={{
                background: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-strong)',
                color: 'var(--color-text-primary)',
              }}
            />
            <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              oz
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              setGoalDraft(String(goal));
              setEditingGoal(true);
            }}
            title="Edit daily goal"
            className="shrink-0 text-[15px] font-semibold tabular-nums"
            style={{ color: reached ? 'var(--color-success)' : 'var(--color-text-primary)' }}
          >
            {formatOz(todayTotal)} / {formatOz(goal)} oz
          </button>
        )}
      </div>

      {/* Progress */}
      <div
        className="mt-3 overflow-hidden"
        style={{ height: 6, borderRadius: 4, background: 'var(--color-bg-surface)' }}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${formatOz(todayTotal)} of ${formatOz(goal)} ounces`}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 4,
            background: fill,
            transition: 'width 200ms ease, background-color 200ms ease',
          }}
        />
      </div>

      <p
        className="mt-2 text-[13px]"
        style={{ color: reached ? 'var(--color-success)' : 'var(--color-text-secondary)' }}
      >
        {goal <= 0
          ? 'Set a daily goal to start tracking'
          : reached
            ? `Goal reached! ${formatOz(todayTotal)} oz`
            : `${pct}% · ${formatOz(goal - todayTotal)} oz to go`}
      </p>

      {/* Quick-add — hold a button to change it, "+" to add another */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <QuickAddRow userId={userId} disabled={goal <= 0} onLog={(oz) => log(oz)} />

        {customOpen ? (
          <span className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              autoFocus
              value={customOz}
              onChange={(e) => setCustomOz(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitCustom();
                if (e.key === 'Escape') setCustomOpen(false);
              }}
              placeholder="oz"
              aria-label="Custom amount in ounces"
              className="w-[72px] rounded-full border px-3 text-center text-[13px] tabular-nums outline-none"
              style={{
                height: 40,
                background: 'var(--color-bg-surface)',
                borderColor: 'var(--color-border-strong)',
                color: 'var(--color-text-primary)',
              }}
            />
            <button
              type="button"
              onClick={submitCustom}
              className="rounded-full px-4 text-[13px] font-semibold active:opacity-85"
              style={{
                height: 40,
                background: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
              }}
            >
              Add
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setCustomOpen(true)}
            disabled={goal <= 0}
            className="rounded-full border px-4 text-[13px] font-medium active:opacity-85 disabled:opacity-40"
            style={{
              height: 40,
              background: 'transparent',
              borderColor: 'var(--color-border-strong)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Custom
          </button>
        )}
      </div>

      {/* Last log + undo */}
      {lastToday && (
        <p className="mt-2.5 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Last: +{formatOz(Number(lastToday.oz))}oz at {formatLogTime(lastToday.created_at)}{' '}
          <button
            type="button"
            onClick={() => {
              haptic();
              void undoLast();
            }}
            className="ml-1 font-medium underline underline-offset-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Undo
          </button>
        </p>
      )}

      {/* 7-day history */}
      <div className="mt-4">
        <WaterHistoryChart data={history} goal={goal} />
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={onDelete}
          className="rounded-xl border px-3 py-1.5 text-[13px] font-medium active:opacity-85"
          style={{
            borderColor: 'color-mix(in srgb, var(--color-danger) 40%, transparent)',
            color: 'var(--color-danger)',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
