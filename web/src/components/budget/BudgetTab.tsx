import { useEffect, useState } from 'react';
import BudgetView, { type BudgetViewMode } from './BudgetView';
import BudgetSwitcher from './BudgetSwitcher';
import { useBudgets } from '../../hooks/budget/useBudgets';

const VIEW_KEY = 'budget.view';
const BUDGET_KEY = 'budget.activeBudgetId';

const VIEWS: { id: BudgetViewMode; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'paycheck', label: 'Paycheck' },
];

/**
 * Budget tab shell. A budget switcher at the top chooses between fully
 * independent budgets; below it, a segmented toggle switches between the
 * Overview table (all groups with linked monthly + weekly amounts) and the
 * Paycheck waterfall. `.budget-scope` injects the UI_SKILL.md color tokens
 * scoped to this tab only.
 */
export default function BudgetTab({ userId }: { userId: string }) {
  const [view, setView] = useState<BudgetViewMode>(
    () => (localStorage.getItem(VIEW_KEY) as BudgetViewMode | null) ?? 'overview'
  );
  const { budgets, loading, createBudget, renameBudget, deleteBudget } = useBudgets(userId);
  const [activeId, setActiveId] = useState<string | null>(() => localStorage.getItem(BUDGET_KEY));

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

  const selectView = (v: BudgetViewMode) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const onCreate = async (name: string) => {
    const created = await createBudget(name);
    if (created) selectBudget(created.id);
  };

  const activeBudgetId =
    activeId && budgets.some((b) => b.id === activeId) ? activeId : budgets[0]?.id ?? null;

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

        {/* Overview / Paycheck toggle */}
        <div className="mb-5 flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg-surface)' }}>
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => selectView(v.id)}
              aria-pressed={view === v.id}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors"
              style={
                view === v.id
                  ? { background: 'var(--color-accent)', color: 'var(--color-accent-text)' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              {v.label}
            </button>
          ))}
        </div>

        {activeBudgetId ? (
          <BudgetView key={activeBudgetId} userId={userId} budgetId={activeBudgetId} view={view} />
        ) : (
          <p className="py-12 text-center text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            {loading ? 'Loading…' : 'No budget yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
