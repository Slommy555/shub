import { useState } from 'react';
import BudgetPeriodView from './BudgetPeriodView';
import { TIMEFRAMES, TIMEFRAME_LABEL, type Timeframe } from '../../types/budget';

const STORAGE_KEY = 'budget.timeframe';

/**
 * Budget tab shell: a single persistent budget viewed through a Daily / Weekly
 * / Monthly lens (last choice remembered). The timeframe only rescales how the
 * shared amounts are shown — it is not separate data. The `.budget-scope`
 * wrapper injects the UI_SKILL.md color tokens scoped to this tab only.
 */
export default function BudgetTab({ userId }: { userId: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>(
    () => (localStorage.getItem(STORAGE_KEY) as Timeframe | null) ?? 'monthly'
  );

  const select = (t: Timeframe) => {
    setTimeframe(t);
    localStorage.setItem(STORAGE_KEY, t);
  };

  return (
    <div
      className="budget-scope min-h-screen"
      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}
    >
      <div className="pb-fab mx-auto w-full max-w-app px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          Budget
        </h1>

        {/* Timeframe lens */}
        <div
          className="mb-5 flex gap-1 rounded-full p-1"
          style={{ background: 'var(--color-bg-surface)' }}
        >
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => select(t)}
              aria-pressed={timeframe === t}
              className="flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors"
              style={
                timeframe === t
                  ? { background: 'var(--color-accent)', color: '#16161f' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              {TIMEFRAME_LABEL[t]}
            </button>
          ))}
        </div>

        <BudgetPeriodView key={timeframe} userId={userId} type={timeframe} />
      </div>
    </div>
  );
}
