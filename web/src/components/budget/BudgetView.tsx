import { useMemo, useState } from 'react';
import {
  formatMoney,
  fromView,
  payDatesThrough,
  periodForCursor,
  savingsOffset,
  shiftCursor,
  toView,
  type BudgetGroup,
  type CreditCard,
} from '../../types/budget';
import { useBudgetGroups } from '../../hooks/budget/useBudgetGroups';
import { useBudgetAllocations } from '../../hooks/budget/useBudgetAllocations';
import { usePayDayIncomes } from '../../hooks/budget/usePayDayIncomes';
import { useMonthPeriodId } from '../../hooks/budget/useMonthPeriodId';
import { useSavingsPool } from '../../hooks/budget/useSavingsPool';
import { useSavingsAccount } from '../../hooks/budget/useSavingsAccount';
import { useSavingsWithdrawnBefore } from '../../hooks/budget/useSavingsWithdrawnBefore';
import { useSavingsDeposits } from '../../hooks/budget/useSavingsDeposits';
import { useCreditCards } from '../../hooks/budget/useCreditCards';
import { useCardPayments } from '../../hooks/budget/useCardPayments';
import { useCardCharges } from '../../hooks/budget/useCardCharges';
import { useScheduledExpenses } from '../../hooks/budget/useScheduledExpenses';
import OverviewTable from './OverviewTable';
import PaycheckList from './PaycheckList';
import CreditCardSection from './CreditCardSection';
import ScheduledExpensesSection from './ScheduledExpensesSection';
import SavingsPoolSection from './SavingsPoolSection';

export type BudgetViewMode = 'overview' | 'paycheck';

/**
 * Shared data layer for the two budget views (Round 2 model).
 *
 * - Group amounts are ISOLATED per period: they live in budget_allocations keyed
 *   by (period_id, group_id), so each month starts blank and nothing bleeds.
 * - Savings earmarks offset a group's cost order-independently via savingsOffset;
 *   only the net (what income must still cover) counts toward totals.
 * - Credit cards (flat weekly line items) and scheduled expenses (one-off, due a
 *   specific month) live in their own tables and sections.
 *
 * Legacy kind='credit_card' groups are hidden from the recurring section.
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
  const allocations = useBudgetAllocations(userId, monthPeriodId);
  const savings = useSavingsPool(userId, budgetId, monthPeriodId);
  const account = useSavingsAccount(userId, budgetId);
  const withdrawnBefore = useSavingsWithdrawnBefore(userId, budgetId, account.startMonth, monthBounds.start_date);
  const deposits = useSavingsDeposits(userId, budgetId, monthBounds.start_date, account.startMonth);
  const creditCards = useCreditCards(userId, budgetId);
  const cardPayments = useCardPayments(userId);
  const cardCharges = useCardCharges(userId);
  const scheduled = useScheduledExpenses(userId, budgetId);

  // Charging a scheduled expense to a card: bump its balance AND log the charge.
  const chargeToCard = (cardId: string, name: string, amount: number) => {
    void creditCards.chargeToCard(cardId, amount);
    void cardCharges.addCharge(cardId, name, amount);
  };
  // Deleting a charge backs its amount out of the card balance.
  const deleteCharge = (charge: { id: string; card_id: string; amount: number }) => {
    void cardCharges.deleteCharge(charge.id);
    const card = creditCards.cards.find((c) => c.id === charge.card_id);
    if (card) void creditCards.updateCard(card.id, { balance: Math.max(0, (Number(card.balance) || 0) - (Number(charge.amount) || 0)) });
  };

  // A card's balance still owed after every payment recorded against it.
  const cardRemaining = (c: CreditCard) => Math.max(0, (Number(c.balance) || 0) - cardPayments.paidTotal(c.id));
  /** Payoff state for a card on a specific pay day (for the Paycheck view). */
  const cardPayoffFor = (c: CreditCard, payDate: string) => {
    const remaining = Math.max(0, (Number(c.balance) || 0) - cardPayments.paidBefore(c.id, payDate));
    const suggested = remaining > 0 ? remaining / payDatesThrough(payDate, c.due_date) : 0;
    return { id: c.id, name: c.name, due_date: c.due_date, remaining, suggested, paid: cardPayments.paymentOn(c.id, payDate) };
  };
  // Average per-paycheck income: divide by the month's actual pay-day count
  // (4 or 5) so a 5-Thursday month isn't overstated.
  const weeklyIncome = monthlyIncome / (payDays.length || 4);

  // Recurring groups = everything except legacy credit-card groups (now in their
  // own table). The "Savings" category (a group named Savings) is a recurring row
  // whose amount is driven by the weekly deposits, and it can't earmark to itself.
  const recurringGroups = useMemo(
    () => groupsApi.groups.filter((g) => g.kind !== 'credit_card'),
    [groupsApi.groups]
  );
  const savingsGroup = useMemo(
    () => recurringGroups.find((g) => g.name.trim().toLowerCase() === 'savings') ?? null,
    [recurringGroups]
  );
  const isSavings = (g: BudgetGroup) => !!savingsGroup && g.id === savingsGroup.id;

  // --- gross (pre-savings) amounts -----------------------------------------
  const allocWeekly = (g: BudgetGroup) => Number(allocations.allocations[g.id]?.amount) || 0;
  const grossMonthlyOf = (g: BudgetGroup) =>
    isSavings(g) ? deposits.monthTotal : toView(allocWeekly(g), 'monthly');
  const grossWeeklyOf = (g: BudgetGroup) => (isSavings(g) ? deposits.monthTotal / 4 : allocWeekly(g));
  const savingsMonthlyOf = (g: BudgetGroup) => savings.earmarkAmounts[g.id] ?? 0;

  // Editing writes the per-period allocation (weekly base). Monthly edits divide
  // back down by the ×4 timeframe factor.
  const saveWeekly = (g: BudgetGroup, entered: number) => void allocations.setAmount(g.id, Math.max(0, entered));
  const saveMonthly = (g: BudgetGroup, entered: number) =>
    void allocations.setAmount(g.id, Math.max(0, fromView(entered, 'monthly')));

  if (view === 'paycheck') {
    return (
      <PaycheckList
        groups={recurringGroups.filter((g) => !isSavings(g))}
        payDays={payDays}
        monthLabel={monthBounds.label}
        onPrevMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, -1))}
        onNextMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, 1))}
        onSetPayDayIncome={setIncome}
        weeklyOnDate={(g) => grossWeeklyOf(g)}
        coveredOf={(g) => Math.min(savingsMonthlyOf(g), grossMonthlyOf(g)) / 4}
        deposits={deposits.deposits}
        onSetDeposit={deposits.setDeposit}
        scheduledForDate={(d) => scheduled.expenses.filter((e) => e.due_date === d)}
        cardPayoffsForDate={(d) =>
          creditCards.cards.map((c) => cardPayoffFor(c, d)).filter((p) => p.remaining > 0 || (p.paid ?? 0) > 0)
        }
        onPayCard={(cardId, d, amt) => void cardPayments.setPayment(cardId, d, amt)}
      />
    );
  }

  // --- summary --------------------------------------------------------------
  const recurringNetMonthly = recurringGroups.reduce(
    (s, g) => s + savingsOffset(grossMonthlyOf(g), savingsMonthlyOf(g)).net,
    0
  );
  const recurringNetWeekly = recurringGroups.reduce(
    (s, g) => s + savingsOffset(grossWeeklyOf(g), savingsMonthlyOf(g) / 4).net,
    0
  );
  const monthlyCovered = recurringGroups.reduce(
    (s, g) => s + Math.min(savingsMonthlyOf(g), grossMonthlyOf(g)),
    0
  );

  const scheduledThisMonth = scheduled.expenses.filter((e) => e.due_month === monthBounds.start_date);
  const scheduledTotal = scheduledThisMonth.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  // Card obligation: for cards with a due date, the suggested weekly pace to
  // clear the remaining balance from this month's first payday through the due
  // date. Cards without a due date have no schedule, so contribute 0.
  const firstPayday = payDays[0]?.date ?? monthBounds.start_date;
  const cardsRemainingTotal = creditCards.cards.reduce((s, c) => s + cardRemaining(c), 0);
  const cardsWeeklySuggested = creditCards.cards.reduce((s, c) => {
    if (!c.due_date) return s;
    const remaining = cardRemaining(c);
    return remaining > 0 ? s + remaining / payDatesThrough(firstPayday, c.due_date) : s;
  }, 0);

  const monthlyAllocated = recurringNetMonthly + scheduledTotal;
  const weeklyAllocated = recurringNetWeekly + cardsWeeklySuggested;
  const monthlyRemaining = monthlyIncome - monthlyAllocated;
  const weeklyRemaining = weeklyIncome - weeklyAllocated;

  const savingsAvailable = account.startingBalance + deposits.contributionsThrough - withdrawnBefore;
  const earmarkTargets = recurringGroups.filter((g) => g.id !== savingsGroup?.id);

  return (
    <>
      <OverviewTable
        groups={recurringGroups}
        title="Recurring Fixed Costs"
        readOnly={(g) => isSavings(g)}
        monthLabel={monthBounds.label}
        onPrevMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, -1))}
        onNextMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, 1))}
        payDays={payDays}
        monthlyIncome={monthlyIncome}
        weeklyIncome={weeklyIncome}
        onSetPayDayIncome={setIncome}
        grossMonthlyOf={grossMonthlyOf}
        grossWeeklyOf={grossWeeklyOf}
        savingsMonthlyOf={savingsMonthlyOf}
        onSaveWeekly={saveWeekly}
        onSaveMonthly={saveMonthly}
        onAddGroup={groupsApi.addGroup}
        onRename={(id, name) => void groupsApi.updateGroup(id, { name })}
        onDelete={groupsApi.deleteGroup}
      />

      <CreditCardSection
        cards={creditCards.cards}
        remainingOf={cardRemaining}
        chargesOf={cardCharges.chargesFor}
        onAdd={creditCards.addCard}
        onUpdate={creditCards.updateCard}
        onDelete={creditCards.deleteCard}
        onDeleteCharge={deleteCharge}
      />

      <ScheduledExpensesSection
        expenses={scheduledThisMonth}
        monthStart={monthBounds.start_date}
        monthLabel={monthBounds.label}
        cards={creditCards.cards}
        onAdd={scheduled.addExpense}
        onChargeToCard={chargeToCard}
        onDelete={scheduled.deleteExpense}
      />

      <SavingsPoolSection
        groups={earmarkTargets}
        hasSavingsCategory={!!savingsGroup}
        deposits={deposits.deposits}
        onSetDeposit={deposits.setDeposit}
        monthDepositTotal={deposits.monthTotal}
        contributionsThrough={deposits.contributionsThrough}
        startMonthLabel={monthLabelOf(account.startMonth)}
        startingBalance={account.startingBalance}
        onSetStartingBalance={account.setStartingBalance}
        available={savingsAvailable}
        allocated={savings.allocated}
        earmarkAmounts={savings.earmarkAmounts}
        onSetEarmark={savings.setEarmark}
      />

      {/* Summary */}
      <div className="mt-6 rounded-2xl border p-4" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
        <SummaryRow label="Monthly" income={monthlyIncome} allocated={monthlyAllocated} remaining={monthlyRemaining} />
        <div className="my-3 border-t" style={{ borderColor: 'var(--color-border)' }} />
        <SummaryRow label="Weekly" income={weeklyIncome} allocated={weeklyAllocated} remaining={weeklyRemaining} />
        {(monthlyCovered > 0 || cardsRemainingTotal > 0) && (
          <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-[12px] tabular-nums" style={{ borderColor: 'var(--color-border)' }}>
            {monthlyCovered > 0 && (
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text-secondary)' }}>Savings covering</span>
                <span style={{ color: 'var(--color-success)' }}>{formatMoney(monthlyCovered)}/mo</span>
              </div>
            )}
            {cardsRemainingTotal > 0 && (
              <div className="flex items-center justify-between">
                <span style={{ color: 'var(--color-text-secondary)' }}>Credit cards owed</span>
                <span style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatMoney(cardsRemainingTotal)} left{cardsWeeklySuggested > 0 ? ` · ~${formatMoney(cardsWeeklySuggested)}/wk` : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function SummaryRow({
  label,
  income,
  allocated,
  remaining,
}: {
  label: string;
  income: number;
  allocated: number;
  remaining: number;
}) {
  const color = remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)';
  return (
    <div>
      <span className="mb-2 block text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
        <Cell caption="Income" value={formatMoney(income)} />
        <Cell caption="Allocated" value={formatMoney(allocated)} />
        <Cell caption="Remaining" value={formatMoney(remaining)} valueColor={color} bold />
      </div>
    </div>
  );
}

function Cell({ caption, value, valueColor, bold }: { caption: string; value: string; valueColor?: string; bold?: boolean }) {
  return (
    <div>
      <span className="block text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        {caption}
      </span>
      <span
        className={`block ${bold ? 'text-lg font-bold' : 'text-[15px] font-medium'}`}
        style={{ color: valueColor ?? 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
      >
        {value}
      </span>
    </div>
  );
}

/** "July 2026" from a YYYY-MM-DD (first-of-month) string. */
function monthLabelOf(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
