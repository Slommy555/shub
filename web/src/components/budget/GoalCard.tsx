import { useState } from 'react';
import type { SavingsGoal } from '../../types/budget';
import { daysUntil, formatMoney } from '../../lib/budget';

export default function GoalCard({
  goal,
  currency,
  onAddFunds,
  onDelete,
}: {
  goal: SavingsGoal;
  currency: string;
  onAddFunds: (goal: SavingsGoal, amount: number) => void;
  onDelete: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const color = goal.color ?? '#6366f1';
  const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;
  const complete = goal.current_amount >= goal.target_amount && goal.target_amount > 0;
  const days = goal.target_date ? daysUntil(goal.target_date) : null;

  function submitFunds() {
    const amt = Number(amount);
    if (Number.isFinite(amt) && amt > 0) onAddFunds(goal, amt);
    setAmount('');
    setAdding(false);
  }

  return (
    <div className={`rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900 ${complete ? 'opacity-90' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {goal.name} {complete && <span className="text-green-600 dark:text-green-400">✓</span>}
            </p>
            <p className="text-[11px] text-gray-400">
              {formatMoney(goal.current_amount, currency)} of {formatMoney(goal.target_amount, currency)}
              {days != null && (
                <> · {days >= 0 ? `${days} days left` : `${Math.abs(days)} days ago`}</>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(goal.id)}
          aria-label="Delete goal"
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
        >
          ×
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold tabular-nums text-gray-500">{Math.round(pct)}%</span>
        {adding ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitFunds()}
              placeholder="Amount"
              aria-label="Amount to add"
              autoFocus
              className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
            />
            <button
              type="button"
              onClick={submitFunds}
              className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs font-semibold text-white dark:bg-gray-200 dark:text-gray-900"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="rounded-lg px-2 py-1 text-xs text-gray-500"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            + Add funds
          </button>
        )}
      </div>
    </div>
  );
}
