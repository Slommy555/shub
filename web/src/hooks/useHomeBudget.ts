import { useMemo, useState } from 'react';
import {
  payDatesThrough,
  periodForCursor,
  toISODate,
  toView,
  weeksInMonth,
  type BudgetGroup,
  type CreditCard,
} from '../types/budget';
import { useBudgets } from './budget/useBudgets';
import { useBudgetGroups } from './budget/useBudgetGroups';
import { useBudgetAllocations } from './budget/useBudgetAllocations';
import { useGroupOverrides } from './budget/useGroupOverrides';
import { useMonthPeriodId } from './budget/useMonthPeriodId';
import { usePayDayIncomes } from './budget/usePayDayIncomes';
import { useSavingsPool } from './budget/useSavingsPool';
import { useSavingsAccount } from './budget/useSavingsAccount';
import { useSavingsDeposits } from './budget/useSavingsDeposits';
import { useCreditCards } from './budget/useCreditCards';
import { useCardPayments } from './budget/useCardPayments';
import { useGroupPayments } from './budget/useGroupPayments';

/** Where the Budget tab stores the budget the user last had open. */
const BUDGET_KEY = 'budget.activeBudgetId';

export interface HomeBudget {
  ready: boolean;
  /** Income for one pay week minus what this week has to cover. */
  weekLeft: number;
  /** Recorded set-asides on this week's pay day. */
  setAside: number;
  /** What this week's set-asides should add up to. */
  setAsideNeeded: number;
  bills: number;
  creditCards: number;
  savingsPool: number;
}

/**
 * The Home tab's budget row, read from the same tables and with the same
 * resolution rules the Budget tab uses:
 *   - a group's monthly amount is its month override if one exists, otherwise
 *     its stored weekly base scaled to a month (the "Savings" category is driven
 *     by its deposits instead);
 *   - a card contributes the weekly pace that clears its balance by its due date;
 *   - the savings pool is this month's `budget_savings_pools.total_saved`.
 *
 * Always the CURRENT month and the current pay week — Home has no month cursor.
 */
export function useHomeBudget(userId: string | null): HomeBudget {
  // The month is fixed for the life of the mount; Home remounts on tab focus.
  const [monthCursor] = useState(() => new Date());
  const monthBounds = useMemo(() => periodForCursor('monthly', monthCursor), [monthCursor]);

  const { budgets } = useBudgets(userId);
  const stored = typeof window !== 'undefined' ? localStorage.getItem(BUDGET_KEY) : null;
  const budgetId =
    stored && budgets.some((b) => b.id === stored) ? stored : budgets[0]?.id ?? null;

  const groupsApi = useBudgetGroups(userId, budgetId);
  const monthPeriodId = useMonthPeriodId(userId, budgetId, monthBounds);
  const allocations = useBudgetAllocations(userId, monthPeriodId);
  const overrides = useGroupOverrides(userId, budgetId, monthBounds.start_date);
  const { payDays, monthlyIncome } = usePayDayIncomes(userId, budgetId, monthBounds.start_date);
  const savings = useSavingsPool(userId, budgetId, monthPeriodId);
  const account = useSavingsAccount(userId, budgetId);
  const deposits = useSavingsDeposits(userId, budgetId, monthBounds.start_date, account.startMonth);
  const creditCards = useCreditCards(userId, budgetId);
  const cardPayments = useCardPayments(userId);
  const groupPayments = useGroupPayments(userId);

  const weeks = weeksInMonth(monthBounds.start_date);
  const today = toISODate(new Date());

  const recurringGroups = useMemo(
    () => groupsApi.groups.filter((g) => g.kind !== 'credit_card'),
    [groupsApi.groups]
  );
  const savingsGroup = useMemo(
    () => recurringGroups.find((g) => g.name.trim().toLowerCase() === 'savings') ?? null,
    [recurringGroups]
  );

  const resolvedMonthlyOf = (g: BudgetGroup): number => {
    if (savingsGroup && g.id === savingsGroup.id) return deposits.monthTotal;
    const o = overrides.overrideFor(g.id);
    if (o) return Number(o.override_amount) || 0;
    return toView(Number(allocations.allocations[g.id]?.amount) || 0, 'monthly');
  };

  const cardRemaining = (c: CreditCard) =>
    Math.max(0, (Number(c.balance) || 0) - cardPayments.paidTotal(c.id));

  const firstPayday = payDays[0]?.date ?? monthBounds.start_date;
  const cardsWeekly = creditCards.cards.reduce((s, c) => {
    if (!c.due_date) return s;
    const remaining = cardRemaining(c);
    return remaining > 0 ? s + remaining / payDatesThrough(firstPayday, c.due_date) : s;
  }, 0);

  const bills = recurringGroups.reduce((s, g) => s + resolvedMonthlyOf(g), 0);
  const creditCardsTotal = cardsWeekly * weeks;

  // This week's pay day: the latest one on or before today, else the first.
  const currentPayDay =
    [...payDays].reverse().find((p) => p.date <= today)?.date ?? payDays[0]?.date ?? null;

  const weeklyIncome = monthlyIncome / (payDays.length || 4);
  const setAsideNeeded = bills / weeks + cardsWeekly;
  const setAside = currentPayDay
    ? recurringGroups.reduce((s, g) => s + (groupPayments.paymentOn(g.id, currentPayDay) ?? 0), 0) +
      creditCards.cards.reduce((s, c) => s + (cardPayments.paymentOn(c.id, currentPayDay) ?? 0), 0) +
      (deposits.deposits.find((d) => d.date === currentPayDay)?.amount ?? 0)
    : 0;

  return {
    ready: budgetId !== null,
    weekLeft: weeklyIncome - setAsideNeeded,
    setAside,
    setAsideNeeded,
    bills,
    creditCards: creditCardsTotal,
    savingsPool: savings.totalSaved,
  };
}
