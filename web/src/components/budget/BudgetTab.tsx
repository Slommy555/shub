import { useEffect, useState } from 'react';
import BudgetPeriodView from './BudgetPeriodView';
import BudgetSwitcher from './BudgetSwitcher';
import { useBudgets } from '../../hooks/budget/useBudgets';
import { TIMEFRAMES, TIMEFRAME_LABEL, type Timeframe } from '../../types/budget';

const TF_KEY = 'budget.timeframe';
const BUDGET_KEY = 'budget.activeBudgetId';

/**
 * Budget tab shell. A budget switcher at the top chooses between fully
 * independent budgets; below it, a Daily / Weekly / Monthly lens picks the
 * period type (last choice remembered). Each period is isolated — amounts set in
 * one period never carry into another. `.budget-scope` injects the UI_SKILL.md
 * color tokens scoped to this tab only.
 */
export default function BudgetTab({ userId }: { userId: string }) {
  const [timeframe, setTimeframe] = useState<Timeframe>(
    () => (localStorage.getItem(TF_KEY) as Timeframe | null) ?? 'monthly'
  );
  const { budgets, loading, createBudget, renameBudget, deleteBudget } = useBudgets(userId);
  const [activeId, setActiveId] = useState<string | null>(
    () => localStorage.getItem(BUDGET_KEY)
  );

  // Keep the active budget valid: fall back to the first budget if the stored
  // one no longer exists (deleted, or first load).
  useEffect(() => {
    if (budgets.length === 0) return;
    if (!activeId || !budgets.some((b) => b.id === activeId)) {
      setActiveId(budgets[0].id);
    }
  }, [budgets, activeId]);

  const selectBudget = (id: string) => {
    setActiveId(id);
    localStorage.setItem(BUDGET_KEY, id);
  };

  const selectTimeframe = (t: Timeframe) => {
    setTimeframe(t);
    localStorage.setItem(TF_KEY, t);
  };

  const onCreate = async (name: string) => {
    const created = await createBudget(name);
    if (created) selectBudget(created.id);
  };

  const activeBudgetId = activeId && budgets.some((b) => b.id === activeId) ? activeId : budgets[0]?.id ?? null;

  return (
    <div
      className="budget-scope min-h-screen"
      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}
    >
      <div className="pb-fab mx-auto w-full max-w-app px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          Budget
        </h1>

        <BudgetSwitcher
          budgets={budgets}
          activeId={activeBudgetId}
          onSelect={selectBudget}
          onCreate={onCreate}
          onRename={renameBudget}
          onDelete={deleteBudget}
        />

        {/* Timeframe lens */}
        <div
          className="mb-5 flex gap-1 rounded-full p-1"
          style={{ background: 'var(--color-bg-surface)' }}
        >
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => selectTimeframe(t)}
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

        {activeBudgetId ? (
          <BudgetPeriodView
            key={`${activeBudgetId}-${timeframe}`}
            userId={userId}
            budgetId={activeBudgetId}
            type={timeframe}
          />
        ) : (
          <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {loading ? 'Loading…' : 'No budget yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
