import { useMemo, useState } from 'react';
import {
  payDatesThrough,
  payWeekThursday,
  periodForCursor,
  savingsOffset,
  toView,
  weeklyFromMonthly,
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
import { useScheduledExpenses } from './budget/useScheduledExpenses';
import { useCreditCards } from './budget/useCreditCards';
import { useCardPayments } from './budget/useCardPayments';
import { useGroupPayments } from './budget/useGroupPayments';

/** Where the Budget tab stores the budget the user last had open. */
const BUDGET_KEY = 'budget.activeBudgetId';

export interface HomeBudget {
  ready: boolean;
  /** "Thu, Jul 30" — the pay week these numbers describe. */
  weekLabel: string;
  /** That pay day's income minus everything the week has to cover. */
  weekLeft: number;
  /** What's actually been set aside on this pay day. */
  setAside: number;
  /** What this pay day should be setting aside in total. */
  setAsideNeeded: number;
  bills: number;
  creditCards: number;
  savingsPool: number;
}

/**
 * The Home tab's budget row. Two rules matter here:
 *
 * 1. It reports the pay week you are CURRENTLY IN — the most recent pay Thursday
 *    on or before today, not the next one coming up (which is what the Paycheck
 *    view opens on). Pay weeks run Thursday–Wednesday, so early in a month that
 *    Thursday can belong to the previous month; the whole read-out follows it, as
 *    a week's amounts come from the month containing its Thursday.
 *
 * 2. The week's numbers mirror the Paycheck waterfall line for line, so Home and
 *    the Budget tab can't disagree:
 *      undated recurring groups → their weekly set-aside, net of savings;
 *      dated groups            → what's recorded, or the flat suggestion when
 *                                Float Savings assumes it;
 *      credit cards            → what's recorded against them that pay day;
 *      scheduled one-offs      → the suggested set-aside toward their due date;
 *      plus that pay day's savings deposit.
 */
export function useHomeBudget(userId: string | null): HomeBudget {
  // Anchor everything to the current pay week, not to "today's month".
  const [payDate] = useState(() => payWeekThursday(new Date()));
  const monthBounds = useMemo(
    () => periodForCursor('monthly', new Date(payDate + 'T00:00:00')),
    [payDate]
  );

  const { budgets } = useBudgets(userId);
  const stored = typeof window !== 'undefined' ? localStorage.getItem(BUDGET_KEY) : null;
  const budgetId =
    stored && budgets.some((b) => b.id === stored) ? stored : budgets[0]?.id ?? null;

  const groupsApi = useBudgetGroups(userId, budgetId);
  const monthPeriodId = useMonthPeriodId(userId, budgetId, monthBounds);
  const allocations = useBudgetAllocations(userId, monthPeriodId);
  const overrides = useGroupOverrides(userId, budgetId, monthBounds.start_date);
  const { payDays } = usePayDayIncomes(userId, budgetId, monthBounds.start_date);
  const savings = useSavingsPool(userId, budgetId, monthPeriodId);
  const account = useSavingsAccount(userId, budgetId);
  const deposits = useSavingsDeposits(userId, budgetId, monthBounds.start_date, account.startMonth);
  const scheduled = useScheduledExpenses(userId, budgetId);
  const creditCards = useCreditCards(userId, budgetId);
  const cardPayments = useCardPayments(userId);
  const groupPayments = useGroupPayments(userId);

  const monthStart = monthBounds.start_date;
  const weeks = weeksInMonth(monthStart);

  const recurringGroups = useMemo(
    () => groupsApi.groups.filter((g) => g.kind !== 'credit_card'),
    [groupsApi.groups]
  );
  const savingsGroup = useMemo(
    () => recurringGroups.find((g) => g.name.trim().toLowerCase() === 'savings') ?? null,
    [recurringGroups]
  );
  const isSavings = (g: BudgetGroup) => !!savingsGroup && g.id === savingsGroup.id;

  // --- the same amount resolver the Budget tab uses -------------------------
  const resolvedMonthlyOf = (g: BudgetGroup): number => {
    if (isSavings(g)) return deposits.monthTotal;
    const o = overrides.overrideFor(g.id);
    if (o) return Number(o.override_amount) || 0;
    return toView(Number(allocations.allocations[g.id]?.amount) || 0, 'monthly');
  };
  const earmarkOf = (g: BudgetGroup) => savings.earmarkAmounts[g.id] ?? 0;
  const grossWeeklyOf = (g: BudgetGroup) => weeklyFromMonthly(resolvedMonthlyOf(g), monthStart);
  /** The share of this week's cost already covered by earmarked savings. */
  const coveredOf = (g: BudgetGroup) =>
    Math.min(earmarkOf(g), resolvedMonthlyOf(g)) / weeks;

  const cardRemaining = (c: CreditCard) =>
    Math.max(0, (Number(c.balance) || 0) - cardPayments.paidTotal(c.id));

  // --- headline monthly totals (the three big tiles) ------------------------
  const firstPayday = payDays[0]?.date ?? monthStart;
  const cardsWeekly = creditCards.cards.reduce((s, c) => {
    if (!c.due_date) return s;
    const remaining = cardRemaining(c);
    return remaining > 0 ? s + remaining / payDatesThrough(firstPayday, c.due_date) : s;
  }, 0);
  const bills = recurringGroups.reduce((s, g) => s + resolvedMonthlyOf(g), 0);

  // --- this pay week's waterfall -------------------------------------------
  let setAside = 0;
  let needed = 0;

  // Undated recurring groups: no ledger, so the weekly set-aside is both the
  // target and what counts as put away.
  for (const g of recurringGroups) {
    if (isSavings(g) || g.due_day != null) continue;
    const amount = Math.max(0, grossWeeklyOf(g) - coveredOf(g));
    setAside += amount;
    needed += amount;
  }

  // Dated groups: a per-month payoff tracker. Float Savings assumes the flat
  // amount without the user confirming it — counting only explicitly recorded
  // payments is what made this read low.
  for (const g of recurringGroups) {
    if (isSavings(g) || g.due_day == null) continue;
    const net = savingsOffset(resolvedMonthlyOf(g), earmarkOf(g)).net;
    const suggested = weeklyFromMonthly(net, monthStart);
    const recorded = groupPayments.paymentOn(g.id, payDate);
    setAside += recorded ?? (g.float_savings === true ? suggested : 0);
    needed += suggested;
  }

  // Credit cards: the pace that clears the balance by the due date. A card with
  // no due date has no schedule, so it asks for nothing this week (the same rule
  // the Bills/Credit tile uses) — it would otherwise demand its whole balance.
  for (const c of creditCards.cards) {
    if (c.due_date) {
      const remaining = Math.max(0, (Number(c.balance) || 0) - cardPayments.paidBefore(c.id, payDate));
      if (remaining > 0) needed += remaining / payDatesThrough(payDate, c.due_date);
    }
    setAside += cardPayments.paymentOn(c.id, payDate) ?? 0;
  }

  // Scheduled one-offs: a flat weekly slice from the pay period the user chose
  // to start saving on through the charge date.
  for (const e of scheduled.expenses) {
    if (!e.due_date || e.due_date < payDate) continue;
    if (e.save_from_date && e.save_from_date > payDate) continue;
    const saved = Math.min(savings.expenseEarmarkAmounts[e.id] ?? 0, Number(e.amount) || 0);
    const remaining = Math.max(0, (Number(e.amount) || 0) - saved);
    if (!(remaining > 0)) continue;
    const start = e.save_from_date ?? (e.created_at ? e.created_at.slice(0, 10) : payDate);
    const amount = remaining / payDatesThrough(start, e.due_date ?? null);
    setAside += amount;
    needed += amount;
  }

  // This pay day's savings deposit counts on both sides — it's money moved, and
  // there's no separate "target deposit" to compare it against.
  const deposit = deposits.deposits.find((d) => d.date === payDate)?.amount ?? 0;
  setAside += deposit;
  needed += deposit;

  const income = payDays.find((p) => p.date === payDate)?.income ?? 0;

  return {
    ready: budgetId !== null,
    weekLabel: new Date(payDate + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    weekLeft: income - setAside,
    setAside,
    setAsideNeeded: needed,
    bills,
    creditCards: cardsWeekly * weeks,
    savingsPool: savings.totalSaved,
  };
}
