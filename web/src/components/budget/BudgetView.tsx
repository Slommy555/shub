import { useMemo, useState } from 'react';
import {
  fromView,
  periodForCursor,
  toView,
  type BudgetGroup,
} from '../../types/budget';
import { useBudgetPeriod } from '../../hooks/budget/useBudgetPeriod';
import { useBudgetGroups } from '../../hooks/budget/useBudgetGroups';
import OverviewTable from './OverviewTable';
import PaycheckList from './PaycheckList';

export type BudgetViewMode = 'overview' | 'paycheck';

/**
 * Shared data layer for the two budget views. Every expense group carries one
 * canonical weekly-base `amount`; Monthly is simply that × 4 (the app's existing
 * TIMEFRAME_FACTOR). Editing either the Monthly or the Weekly cell writes back
 * through `toView` / `fromView`, so the two columns stay linked. Income is read
 * from (and written to) the current week / current month period rows — the same
 * setter used before, just surfaced as two independent inputs.
 *
 * Toggling between Overview and Paycheck keeps this data mounted, so switching is
 * instant and never re-fetches.
 */
export default function BudgetView({
  userId,
  budgetId,
  view,
}: {
  userId: string;
  budgetId: string;
  view: BudgetViewMode;
}) {
  // Anchor income to the current week / month. Frozen at mount so the period
  // bounds stay stable (a fresh Date() every render would thrash the hooks).
  const [cursor] = useState<Date>(() => new Date());
  const weekBounds = useMemo(() => periodForCursor('weekly', cursor), [cursor]);
  const monthBounds = useMemo(() => periodForCursor('monthly', cursor), [cursor]);

  const weekly = useBudgetPeriod(userId, budgetId, 'weekly', weekBounds);
  const monthly = useBudgetPeriod(userId, budgetId, 'monthly', monthBounds);
  const groupsApi = useBudgetGroups(userId, budgetId);

  const weeklyIncome = weekly.period?.income ?? 0;
  const monthlyIncome = monthly.period?.income ?? 0;

  const weeklyOf = (g: BudgetGroup) => Number(g.amount) || 0;
  const monthlyOf = (g: BudgetGroup) => toView(weeklyOf(g), 'monthly');

  /** Edits to either column resolve to the same canonical weekly-base amount. */
  const saveWeekly = (g: BudgetGroup, entered: number) =>
    void groupsApi.updateGroup(g.id, { amount: Math.max(0, entered), persistent: true });
  const saveMonthly = (g: BudgetGroup, entered: number) =>
    void groupsApi.updateGroup(g.id, { amount: Math.max(0, fromView(entered, 'monthly')), persistent: true });

  if (view === 'paycheck') {
    return (
      <PaycheckList
        groups={groupsApi.groups}
        seedIncome={weeklyIncome}
        weeklyOf={weeklyOf}
      />
    );
  }

  return (
    <OverviewTable
      groups={groupsApi.groups}
      weeklyIncome={weeklyIncome}
      monthlyIncome={monthlyIncome}
      weeklyOf={weeklyOf}
      monthlyOf={monthlyOf}
      onSaveWeekly={saveWeekly}
      onSaveMonthly={saveMonthly}
      onSetWeeklyIncome={weekly.setIncome}
      onSetMonthlyIncome={monthly.setIncome}
      onAddGroup={groupsApi.addGroup}
      onRename={(id, name) => void groupsApi.updateGroup(id, { name })}
      onDelete={groupsApi.deleteGroup}
    />
  );
}
