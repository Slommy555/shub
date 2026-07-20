import { useMemo, useState } from 'react';
import {
  creditCardAmountForPeriod,
  creditCardWeekly,
  formatMoney,
  fromView,
  periodForCursor,
  shiftCursor,
  toView,
  type BudgetGroup,
} from '../../types/budget';
import { useBudgetGroups } from '../../hooks/budget/useBudgetGroups';
import { usePayDayIncomes } from '../../hooks/budget/usePayDayIncomes';
import { useMonthPeriodId } from '../../hooks/budget/useMonthPeriodId';
import { useSavingsPool } from '../../hooks/budget/useSavingsPool';
import { useSavingsAccount } from '../../hooks/budget/useSavingsAccount';
import { useSavingsWithdrawnBefore } from '../../hooks/budget/useSavingsWithdrawnBefore';
import OverviewTable from './OverviewTable';
import PaycheckList from './PaycheckList';
import CreditCardBox, { CARD_COLOR } from './CreditCardBox';
import SavingsPoolSection from './SavingsPoolSection';

export type BudgetViewMode = 'overview' | 'paycheck';

/**
 * Shared data layer for the two budget views. Every standard group carries one
 * canonical weekly-base `amount`; Monthly is that × 4 (the app's TIMEFRAME_FACTOR)
 * and editing either column writes back through `toView` / `fromView`.
 *
 * Credit cards live in their own box (groups with kind='credit_card'): their
 * payoff-window payment for the selected month counts toward the budget. A
 * savings pool (per selected month) can earmark funds toward any group, offsetting
 * what income must cover — so Remaining = income − (expenses + cards − savings).
 *
 * A selectable month drives the income side (its four pay-day Thursdays) and the
 * card payments / savings pool; standard group amounts are recurring and stay
 * constant across months.
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
  const monthPeriodId = useMonthPeriodId(userId, budgetId, monthBounds);
  const savings = useSavingsPool(userId, budgetId, monthPeriodId);
  const account = useSavingsAccount(userId, budgetId);
  const withdrawnBefore = useSavingsWithdrawnBefore(userId, budgetId, account.startMonth, monthBounds.start_date);
  const weeklyIncome = monthlyIncome / 4;

  const cards = useMemo(
    () => groupsApi.groups.filter((g) => g.kind === 'credit_card'),
    [groupsApi.groups]
  );
  // The "Savings" category (a group named Savings) funds the running balance and
  // is excluded from the list of things you can earmark savings toward.
  const savingsGroup = useMemo(
    () => groupsApi.groups.find((g) => g.name.trim().toLowerCase() === 'savings') ?? null,
    [groupsApi.groups]
  );

  /** A card's payment attributable to the selected month (payoff-window aware). */
  const cardMonthlyOf = (g: BudgetGroup) => creditCardAmountForPeriod(g, 'monthly', monthBounds);
  /** Weekly obligation: a card's flat weekly payment, else the recurring amount. */
  const weeklyOf = (g: BudgetGroup) =>
    g.kind === 'credit_card' ? creditCardWeekly(g.cc_total, g.cc_weeks) : Number(g.amount) || 0;
  /** Monthly cost: a card's payoff-window payment this month, else amount × 4. */
  const monthlyOf = (g: BudgetGroup) =>
    g.kind === 'credit_card' ? cardMonthlyOf(g) : toView(Number(g.amount) || 0, 'monthly');
  const isCard = (g: BudgetGroup) => g.kind === 'credit_card';

  /** Edits to either column resolve to the same canonical weekly-base amount. */
  const saveWeekly = (g: BudgetGroup, entered: number) =>
    void groupsApi.updateGroup(g.id, { amount: Math.max(0, entered), persistent: true });
  const saveMonthly = (g: BudgetGroup, entered: number) =>
    void groupsApi.updateGroup(g.id, { amount: Math.max(0, fromView(entered, 'monthly')), persistent: true });

  /** Weekly amount a group's savings earmark covers (fully-covered → drops out). */
  const weeklyCoveredOf = (g: BudgetGroup) =>
    Math.min(savings.earmarkAmounts[g.id] ?? 0, monthlyOf(g)) / 4;

  if (view === 'paycheck') {
    return (
      <PaycheckList
        groups={groupsApi.groups}
        payDays={payDays}
        onSetPayDayIncome={setIncome}
        weeklyOf={weeklyOf}
        coveredOf={weeklyCoveredOf}
      />
    );
  }

  // Budget bottom line: every group (including cards, shown in the table) minus
  // the savings earmarked toward them.
  const allMonthly = groupsApi.groups.reduce((s, g) => s + monthlyOf(g), 0);
  const allWeekly = groupsApi.groups.reduce((s, g) => s + weeklyOf(g), 0);
  const monthlyCovered = groupsApi.groups.reduce(
    (s, g) => s + Math.min(savings.earmarkAmounts[g.id] ?? 0, monthlyOf(g)),
    0
  );
  const weeklyCovered = monthlyCovered / 4;

  const monthlyRemaining = monthlyIncome - (allMonthly - monthlyCovered);
  const weeklyRemaining = weeklyIncome - (allWeekly - weeklyCovered);

  // Running savings balance: starting point + monthly Savings-category
  // contributions through this month − everything allocated in prior months.
  const monthlyContribution = savingsGroup ? monthlyOf(savingsGroup) : 0;
  const monthsCounted = monthsInclusive(account.startMonth, monthBounds.start_date);
  const savingsAvailable = account.startingBalance + monthlyContribution * monthsCounted - withdrawnBefore;
  const earmarkTargets = groupsApi.groups.filter((g) => g.id !== savingsGroup?.id);

  return (
    <>
      <OverviewTable
        groups={groupsApi.groups}
        amountReadOnly={isCard}
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

      <CreditCardBox
        cards={cards}
        monthlyOf={cardMonthlyOf}
        onAdd={(name) => void groupsApi.addGroup(name, CARD_COLOR, 'credit_card')}
        onUpdate={(id, patch) => void groupsApi.updateGroup(id, patch)}
        onDelete={groupsApi.deleteGroup}
      />

      <SavingsPoolSection
        groups={earmarkTargets}
        hasSavingsCategory={!!savingsGroup}
        monthlyContribution={monthlyContribution}
        monthsCounted={monthsCounted}
        startMonthLabel={monthLabelOf(account.startMonth)}
        startingBalance={account.startingBalance}
        onSetStartingBalance={account.setStartingBalance}
        available={savingsAvailable}
        allocated={savings.allocated}
        earmarkAmounts={savings.earmarkAmounts}
        onSetEarmark={savings.setEarmark}
      />

      {/* Bottom line */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        <RemainingCell label="Monthly remaining" value={monthlyRemaining} savings={monthlyCovered} />
        <RemainingCell label="Weekly remaining" value={weeklyRemaining} savings={weeklyCovered} />
      </div>
    </>
  );
}

function RemainingCell({
  label,
  value,
  savings,
}: {
  label: string;
  value: number;
  savings: number;
}) {
  const color = value >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  const parts: string[] = [];
  if (savings > 0) parts.push(`+ ${formatMoney(savings)} from savings`);
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <span className="mb-1 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span className="text-xl font-bold tabular-nums" style={{ color, letterSpacing: '-0.02em' }}>
        {formatMoney(value)}
      </span>
      {parts.length > 0 && (
        <span className="mt-1 block text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
          {parts.join(' · ')}
        </span>
      )}
    </div>
  );
}

/** Months from `startISO` to `selectedISO` inclusive (0 if the view is earlier). */
function monthsInclusive(startISO: string, selectedISO: string): number {
  const [sy, sm] = startISO.split('-').map(Number);
  const [ty, tm] = selectedISO.split('-').map(Number);
  const diff = (ty - sy) * 12 + (tm - sm);
  return diff < 0 ? 0 : diff + 1;
}

/** "July 2026" from a YYYY-MM-DD (first-of-month) string. */
function monthLabelOf(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
