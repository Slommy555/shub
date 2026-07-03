import { useState } from 'react';
import type { UseSavingsGoals } from '../../hooks/budget/useSavingsGoals';
import { BUDGET_COLORS } from '../../types/budget';
import GoalCard from './GoalCard';

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

export default function GoalsTab({ api, currency }: { api: UseSavingsGoals; currency: string }) {
  const [showForm, setShowForm] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState(BUDGET_COLORS[0]);

  const active = api.goals.filter((g) => !(g.current_amount >= g.target_amount && g.target_amount > 0));
  const completed = api.goals.filter((g) => g.current_amount >= g.target_amount && g.target_amount > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(target);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0) return;
    api.addGoal({ name, target_amount: amt, target_date: date || null, color });
    setName('');
    setTarget('');
    setDate('');
    setShowForm(false);
  }

  return (
    <div className="space-y-3">
      {showForm ? (
        <form onSubmit={submit} className="space-y-2.5 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name" aria-label="Goal name" className={inputCls} autoFocus />
          <div className="flex gap-2">
            <input type="number" inputMode="decimal" min="0" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target amount" aria-label="Target amount" className={inputCls} />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Target date" className={inputCls} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {BUDGET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`h-6 w-6 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-gray-500 dark:ring-offset-gray-900' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white dark:bg-gray-200 dark:text-gray-900">
                Create
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl border border-dashed border-gray-300 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          + New goal
        </button>
      )}

      {active.length === 0 && completed.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400 dark:border-gray-800">
          No savings goals yet. Create one to start tracking.
        </p>
      )}

      <div className="space-y-2">
        {active.map((g) => (
          <GoalCard key={g.id} goal={g} currency={currency} onAddFunds={api.addFunds} onDelete={api.deleteGoal} />
        ))}
      </div>

      {completed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowCompleted((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400"
          >
            <span>Completed · {completed.length}</span>
            <span>{showCompleted ? '▲' : '▼'}</span>
          </button>
          {showCompleted && (
            <div className="space-y-2">
              {completed.map((g) => (
                <GoalCard key={g.id} goal={g} currency={currency} onAddFunds={api.addFunds} onDelete={api.deleteGoal} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
