import { useState } from 'react';
import BudgetPeriodView from './BudgetPeriodView';
import type { PeriodType } from '../../types/budget';

const STORAGE_KEY = 'budget.subtab';

/**
 * Budget tab shell: a Weekly / Monthly sub-tab switcher (last choice remembered
 * in localStorage) over the shared period view. The `.budget-scope` wrapper
 * injects the UI_SKILL.md color tokens scoped to this tab only.
 */
export default function BudgetTab({ userId }: { userId: string }) {
  const [type, setType] = useState<PeriodType>(
    () => (localStorage.getItem(STORAGE_KEY) as PeriodType | null) ?? 'weekly'
  );

  const select = (t: PeriodType) => {
    setType(t);
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

        {/* Sub-tab switcher */}
        <div
          className="mb-5 flex gap-1 rounded-full p-1"
          style={{ background: 'var(--color-bg-surface)' }}
        >
          {(['weekly', 'monthly'] as PeriodType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => select(t)}
              aria-pressed={type === t}
              className="flex-1 rounded-full py-2.5 text-sm font-semibold transition-colors"
              style={
                type === t
                  ? { background: 'var(--color-accent)', color: '#16161f' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              {t === 'weekly' ? 'Weekly' : 'Monthly'}
            </button>
          ))}
        </div>

        <BudgetPeriodView key={type} userId={userId} type={type} />
      </div>
    </div>
  );
}
