import { useMemo } from 'react';
import { useHabits } from '../hooks/useHabits';
import { todayISO } from '../lib/dates';
import { completionRate } from '../lib/habits';
import AddHabitForm from './focus/AddHabitForm';
import HabitCard from './focus/HabitCard';

/** The Focus tab: daily habits & goals with consistency stats. */
export default function ProductivityView({ userId }: { userId: string }) {
  const { habits, loading, error, doneByHabit, addHabit, updateHabit, deleteHabit, toggle } =
    useHabits(userId);
  const today = todayISO();

  const { doneToday, avgConsistency } = useMemo(() => {
    if (habits.length === 0) return { doneToday: 0, avgConsistency: 0 };
    let done = 0;
    let rateSum = 0;
    for (const h of habits) {
      const set = doneByHabit.get(h.id) ?? new Set<string>();
      if (set.has(today)) done++;
      rateSum += completionRate(set, today, h.created_at.slice(0, 10));
    }
    return {
      doneToday: done,
      avgConsistency: Math.round((rateSum / habits.length) * 100),
    };
  }, [habits, doneByHabit, today]);

  return (
    <div className="pb-fab mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <h1 className="text-xl font-bold tracking-tight">Focus</h1>
      <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
        Build habits and goals, check them off daily, and track how consistent you are.
      </p>

      {/* Summary */}
      {habits.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat label="Done today" value={`${doneToday}/${habits.length}`} />
          <Stat label="Tracking" value={String(habits.length)} />
          <Stat label="Consistency" value={`${avgConsistency}%`} sub="last 30 days" />
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4">
        <AddHabitForm onAdd={addHabit} />
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-400">Loading…</div>
      ) : habits.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 py-20 text-center dark:border-gray-800">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-gray-300 dark:text-gray-700">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            No habits yet.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Add your first habit or goal above to start tracking.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              done={doneByHabit.get(h.id) ?? new Set()}
              today={today}
              onToggle={(date) => toggle(h.id, date)}
              onChangeColor={(color) => updateHabit(h.id, { color })}
              onDelete={() => deleteHabit(h.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 text-center dark:border-gray-800 dark:bg-gray-900">
      <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
