import BudgetPeriodView from './BudgetPeriodView';

/**
 * Budget tab shell: a single persistent budget used to gauge usual expenses.
 * The `.budget-scope` wrapper injects the UI_SKILL.md color tokens scoped to
 * this tab only.
 */
export default function BudgetTab({ userId }: { userId: string }) {
  return (
    <div
      className="budget-scope min-h-screen"
      style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}
    >
      <div className="pb-fab mx-auto w-full max-w-app px-4 py-6 sm:px-6">
        <h1 className="mb-5 text-xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          Budget
        </h1>

        <BudgetPeriodView userId={userId} />
      </div>
    </div>
  );
}
