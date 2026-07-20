import { useMemo, useState } from 'react';
import {
  fromView,
  periodForCursor,
  shiftCursor,
  toView,
  type BudgetGroup,
} from '../../types/budget';
import { useBudgetGroups } from '../../hooks/budget/useBudgetGroups';
import { usePayDayIncomes } from '../../hooks/budget/usePayDayIncomes';
import OverviewTable from './OverviewTable';
import PaycheckList from './PaycheckList';

export type BudgetViewMode = 'overview' | 'paycheck';

/**
 * Shared data layer for the two budget views. Every expense group carries one
 * canonical weekly-base `amount`; Monthly is simply that × 4 (the app's existing
 * TIMEFRAME_FACTOR). Editing either the Monthly or the Weekly cell writes back
 * through `toView` / `fromView`, so the two columns stay linked.
 *
 * A selectable month drives the income side: its four pay-day Thursdays each hold
 * an editable weekly income, and the monthly income is their sum (weekly income =
 * monthly ÷ 4, matching the app's four-pay-periods-per-month convention). Group
 * amounts are recurring, so they stay constant as you move between months —
 * changing months compares the same expenses against that month's paychecks.
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
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date());
  const monthBounds = useMemo(() => periodForCursor('monthly', monthCursor), [monthCursor]);

  const groupsApi = useBudgetGroups(userId, budgetId);
  const { payDays, monthlyIncome, setIncome } = usePayDayIncomes(userId, budgetId, monthBounds.start_date);
  const weeklyIncome = monthlyIncome / 4;

  const weeklyOf = (g: BudgetGroup) => Number(g.amount) || 0;
  const monthlyOf = (g: BudgetGroup) => toView(weeklyOf(g), 'monthly');

  /** Edits to either column resolve to the same canonical weekly-base amount. */
  const saveWeekly = (g: BudgetGroup, entered: number) =>
    void groupsApi.updateGroup(g.id, { amount: Math.max(0, entered), persistent: true });
  const saveMonthly = (g: BudgetGroup, entered: number) =>
    void groupsApi.updateGroup(g.id, { amount: Math.max(0, fromView(entered, 'monthly')), persistent: true });

  if (view === 'paycheck') {
    return <PaycheckList groups={groupsApi.groups} seedIncome={weeklyIncome} weeklyOf={weeklyOf} />;
  }

  return (
    <OverviewTable
      groups={groupsApi.groups}
      monthLabel={monthBounds.label}
      onPrevMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, -1))}
      onNextMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, 1))}
      payDays={payDays}
      monthlyIncome={monthlyIncome}
      weeklyIncome={weeklyIncome}
      onSetPayDayIncome={setIncome}
      weeklyOf={weeklyOf}
      monthlyOf={monthlyOf}
      onSaveWeekly={saveWeekly}
      onSaveMonthly={saveMonthly}
      onAddGroup={groupsApi.addGroup}
      onRename={(id, name) => void groupsApi.updateGroup(id, { name })}
      onDelete={groupsApi.deleteGroup}
    />
  );
}
