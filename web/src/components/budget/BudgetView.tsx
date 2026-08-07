import { useMemo, useState } from 'react';
import {
  fromView,
  payDatesThrough,
  periodForCursor,
  savingsOffset,
  shiftCursor,
  toISODate,
  toView,
  weeklyFromMonthly,
  weekContainsChargeDay,
  weeksInMonth,
  monthlyFromWeekly,
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
import { useSavingsAdjustments } from '../../hooks/budget/useSavingsAdjustments';
import { useSavingsFlows } from '../../hooks/budget/useSavingsFlows';
import { buildSavingsBuckets, type SavingsBucket, type SavingsGranularity } from '../../lib/savingsSeries';
import { useCreditCards } from '../../hooks/budget/useCreditCards';
import { useCardPayments } from '../../hooks/budget/useCardPayments';
import { useGroupPayments } from '../../hooks/budget/useGroupPayments';
import { useCardCharges } from '../../hooks/budget/useCardCharges';
import { useScheduledExpenses } from '../../hooks/budget/useScheduledExpenses';
import OverviewTable from './OverviewTable';
import PaycheckList from './PaycheckList';
import CreditCardSection from './CreditCardSection';
import ScheduledExpensesSection from './ScheduledExpensesSection';
import SavingsPoolSection from './SavingsPoolSection';
import SavingsTrend from './SavingsTrend';
import BudgetCalendar, { type CalEvent } from './BudgetCalendar';
import BudgetSnapshot from './BudgetSnapshot';
import AllocationBreakdown from './AllocationBreakdown';
import { useGroupOverrides } from '../../hooks/budget/useGroupOverrides';

export type BudgetViewMode = 'snapshot' | 'overview' | 'paycheck' | 'calendar';

/** Remembers whether the savings trend was last read by day, week or month. */
const TREND_KEY = 'budget.savingsTrendGranularity';

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
  const [granularity, setGranularity] = useState<SavingsGranularity>(
    () => (localStorage.getItem(TREND_KEY) as SavingsGranularity | null) ?? 'monthly'
  );

  const groupsApi = useBudgetGroups(userId, budgetId);
  const { payDays, monthlyIncome, setIncome } = usePayDayIncomes(userId, budgetId, monthBounds.start_date);
  const monthPeriodId = useMonthPeriodId(userId, budgetId, monthBounds);
  const allocations = useBudgetAllocations(userId, monthPeriodId);
  const savings = useSavingsPool(userId, budgetId, monthPeriodId);
  const account = useSavingsAccount(userId, budgetId);
  const withdrawnBefore = useSavingsWithdrawnBefore(userId, budgetId, account.startMonth, monthBounds.start_date);
  const deposits = useSavingsDeposits(userId, budgetId, monthBounds.start_date, account.startMonth);
  const adjustments = useSavingsAdjustments(userId, budgetId);
  const flowEvents = useSavingsFlows(userId, budgetId, account.startMonth, monthBounds.start_date);
  const creditCards = useCreditCards(userId, budgetId);
  const cardPayments = useCardPayments(userId);
  const groupPayments = useGroupPayments(userId);
  const cardCharges = useCardCharges(userId);
  const scheduled = useScheduledExpenses(userId, budgetId);
  const overrides = useGroupOverrides(userId, budgetId, monthBounds.start_date);

  /** Thursdays in the month in view — the ONLY divisor for weekly set-asides. */
  const weeks = weeksInMonth(monthBounds.start_date);

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

  // Savings earmarked toward a scheduled expense (capped at its amount).
  const savedForExpense = (e: { id: string; amount: number }) =>
    Math.min(savings.expenseEarmarkAmounts[e.id] ?? 0, Number(e.amount) || 0);
  /** Payoff note for a scheduled expense on a pay day: net still owed after
   *  savings, and a FLAT weekly set-aside. The net is spread evenly across the pay
   *  weeks from the pay period the user chose to start saving on (save_from_date,
   *  falling back to the created date for older rows) through its charge date, so
   *  the "put away each week" amount stays constant week to week rather than
   *  climbing as the date nears. */
  const scheduledPayoffFor = (
    e: { id: string; name: string; amount: number; due_date?: string | null; save_from_date?: string | null; created_at?: string },
    payDate: string
  ) => {
    const remaining = Math.max(0, (Number(e.amount) || 0) - savedForExpense(e));
    const start = e.save_from_date ?? (e.created_at ? e.created_at.slice(0, 10) : payDate);
    const suggested = remaining > 0 ? remaining / payDatesThrough(start, e.due_date ?? null) : 0;
    return { id: e.id, name: e.name, due_date: e.due_date ?? null, remaining, suggested };
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

  /** A group's monthly amount ignoring any override — the default every other
   *  month uses. The Savings category is driven by its deposits instead. */
  const defaultMonthlyOf = (g: BudgetGroup) =>
    isSavings(g) ? deposits.monthTotal : toView(allocWeekly(g), 'monthly');

  /**
   * THE amount resolver. Every display and every total goes through this, so an
   * override can never be applied in one place and missed in another:
   *   1. an override row for (group, this month) wins;
   *   2. otherwise the group's default monthly amount.
   */
  const resolvedMonthlyOf = (g: BudgetGroup) => {
    if (isSavings(g)) return deposits.monthTotal;
    const o = overrides.overrideFor(g.id);
    return o ? Number(o.override_amount) || 0 : defaultMonthlyOf(g);
  };

  const grossMonthlyOf = resolvedMonthlyOf;
  /**
   * The weekly set-aside: the resolved monthly spread over the month's actual
   * weeks. `due_day` is deliberately absent — a charge day says WHEN a bill
   * hits, never HOW MUCH to put away each week.
   */
  const grossWeeklyOf = (g: BudgetGroup) =>
    weeklyFromMonthly(resolvedMonthlyOf(g), monthBounds.start_date);
  const savingsMonthlyOf = (g: BudgetGroup) => savings.earmarkAmounts[g.id] ?? 0;

  // Editing an amount edits whatever is in force: the override when this month
  // has one, otherwise the default allocation (stored as a weekly base).
  const saveMonthly = (g: BudgetGroup, entered: number) => {
    const amount = Math.max(0, entered);
    if (overrides.overrideFor(g.id)) void overrides.setOverride(g.id, amount);
    else void allocations.setAmount(g.id, fromView(amount, 'monthly'));
  };
  const saveWeekly = (g: BudgetGroup, entered: number) =>
    saveMonthly(g, monthlyFromWeekly(Math.max(0, entered), monthBounds.start_date));

  /** The charge date for a day-of-month in a given month, clamped to its length. */
  const chargeDateOn = (day: number, year: number, monthIndex0: number): Date => {
    const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
    return new Date(year, monthIndex0, Math.min(Math.max(1, day), lastDay));
  };

  /**
   * A dated fixed cost as a per-month payoff tracker.
   *
   * The suggested set-aside is the FLAT monthly ÷ weeks split and nothing else.
   * It used to be `remaining ÷ pay days until the next charge day`, which made a
   * bill on the 5th demand far more per week than the same bill on the 25th —
   * the bug Fix 1 addresses. The charge day now only decides the date shown and
   * whether the "charges this week" marker appears.
   */
  const groupPayoffFor = (g: BudgetGroup, payDate: string) => {
    const net = savingsOffset(grossMonthlyOf(g), savingsMonthlyOf(g)).net;
    const suggested = weeklyFromMonthly(net, monthBounds.start_date);

    // With Float Savings on, the flat amount is assumed set aside on every pay
    // day without the user confirming it — there's nothing to decide when the
    // split is even. An explicitly recorded amount always wins over the
    // assumption, and "Use $X" writes the suggestion back over a custom one.
    const autoUse = g.float_savings === true;
    const recordedOn = (d: string) => groupPayments.paymentOn(g.id, d);
    const setAsideOn = (d: string) => recordedOn(d) ?? (autoUse ? suggested : 0);

    // The funding cycle is the calendar month, matching where the amount comes
    // from — set-asides earlier in the month count against this month's bill.
    // pay days come from thursdaysInMonth, the same source as `weeks`, so an
    // untouched float month lands exactly on `net` by the final pay day.
    const paidBefore = payDays
      .filter((p) => p.date >= monthBounds.start_date && p.date < payDate)
      .reduce((s, p) => s + setAsideOn(p.date), 0);
    const remaining = Math.max(0, net - paidBefore);
    const [cy, cm] = monthBounds.start_date.split('-').map(Number);
    const chargeISO = g.due_day != null ? toISODate(chargeDateOn(g.due_day, cy, cm - 1)) : null;
    return {
      id: g.id,
      name: g.name,
      color: g.color,
      due_date: chargeISO,
      remaining,
      suggested,
      paid: autoUse ? setAsideOn(payDate) : recordedOn(payDate),
      /** The shown amount is the assumed one, not something the user entered. */
      autoUsed: autoUse && recordedOn(payDate) === undefined,
      // Float Savings never changes `suggested` — only whether it's assumed.
      chargesThisWeek:
        g.float_savings === true && g.due_day != null && weekContainsChargeDay(payDate, g.due_day),
    };
  };
  const isDated = (g: BudgetGroup) => g.due_day != null;

  /**
   * Every dated money event in a calendar month — pay days in, fixed-cost charge
   * days, one-off scheduled expenses and card due dates out. Shared by the
   * Calendar view and the Snapshot's "coming up" list. Pay-day income is only
   * known for the month currently loaded, so other months contribute outflows.
   */
  const buildEvents = (monthStartISO: string): CalEvent[] => {
    const ym = monthStartISO.slice(0, 7);
    const [cy, cm] = monthStartISO.split('-').map(Number);
    const events: CalEvent[] = [];

    for (const p of payDays) {
      if (p.date.slice(0, 7) !== ym || !(p.income > 0)) continue;
      events.push({ date: p.date, kind: 'pay', label: 'Paycheck', amount: p.income, color: 'var(--color-success)' });
    }
    // Fixed costs with a charge day (net of savings).
    for (const g of recurringGroups) {
      if (isSavings(g) || g.due_day == null) continue;
      const net = savingsOffset(grossMonthlyOf(g), savingsMonthlyOf(g)).net;
      if (!(net > 0)) continue;
      events.push({ date: toISODate(chargeDateOn(g.due_day, cy, cm - 1)), kind: 'fixed', label: g.name, amount: net, color: g.color });
    }
    // Scheduled one-off expenses dated to this month.
    for (const e of scheduled.expenses) {
      if (!e.due_date || e.due_date.slice(0, 7) !== ym) continue;
      events.push({ date: e.due_date, kind: 'scheduled', label: e.name, amount: Number(e.amount) || 0, color: '#f0a04b' });
    }
    // Credit-card due dates. A card's due_date is a single date, but a card bill
    // comes due the same day EVERY month — so plot its day-of-month in whatever
    // month is in view (clamped to the last day for short months). Cards whose
    // balance is cleared drop off.
    for (const c of creditCards.cards) {
      if (!c.due_date) continue;
      const remaining = cardRemaining(c);
      if (!(remaining > 0)) continue;
      const day = Number(c.due_date.slice(8, 10));
      events.push({ date: toISODate(chargeDateOn(day, cy, cm - 1)), kind: 'card', label: c.name, amount: remaining, color: '#5c9eff' });
    }
    return events;
  };

  if (view === 'paycheck') {
    return (
      <PaycheckList
        groups={recurringGroups.filter((g) => !isSavings(g) && !isDated(g))}
        payDays={payDays}
        monthLabel={monthBounds.label}
        onPrevMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, -1))}
        onNextMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, 1))}
        onSetPayDayIncome={setIncome}
        weeklyOnDate={(g) => grossWeeklyOf(g)}
        coveredOf={(g) => Math.min(savingsMonthlyOf(g), grossMonthlyOf(g)) / weeks}
        deposits={deposits.deposits}
        onSetDeposit={deposits.setDeposit}
        scheduledPayoffsForDate={(d) =>
          scheduled.expenses
            // Only from the pay period the user chose to start saving on.
            .filter((e) => e.due_date && e.due_date >= d && (!e.save_from_date || e.save_from_date <= d))
            .map((e) => scheduledPayoffFor(e, d))
            .filter((p) => p.remaining > 0)
        }
        cardPayoffsForDate={(d) =>
          creditCards.cards.map((c) => cardPayoffFor(c, d)).filter((p) => p.remaining > 0 || (p.paid ?? 0) > 0)
        }
        onPayCard={(cardId, d, amt) => void cardPayments.setPayment(cardId, d, amt)}
        groupPayoffsForDate={(d) =>
          recurringGroups
            .filter((g) => !isSavings(g) && isDated(g))
            .map((g) => groupPayoffFor(g, d))
            .filter((p) => p.remaining > 0 || (p.paid ?? 0) > 0)
        }
        onPayGroup={(groupId, d, amt) => void groupPayments.setPayment(groupId, d, amt)}
      />
    );
  }

  if (view === 'calendar') {
    return (
      <BudgetCalendar
        monthStart={monthBounds.start_date}
        monthLabel={monthBounds.label}
        onPrevMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, -1))}
        onNextMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, 1))}
        events={buildEvents(monthBounds.start_date)}
      />
    );
  }

  // --- shared derived state -------------------------------------------------
  // Scheduled expenses dated to this month, and how much of them savings has
  // already earmarked (the Savings Pool section and the snapshot both read it).
  const scheduledThisMonth = scheduled.expenses.filter((e) => e.due_month === monthBounds.start_date);

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

  const todayISO = toISODate(new Date());

  // Hand adjustments are real movements of the balance, so they count toward what
  // savings can cover — both the earmark cap and every balance read-out.
  const adjustmentsThrough = adjustments.totalThrough(monthBounds.end_date);
  const adjustedThisMonth = adjustments.adjustments
    .filter((a) => a.adj_date >= monthBounds.start_date && a.adj_date <= monthBounds.end_date)
    .reduce((s, a) => s + a.amount, 0);
  const savingsAvailable =
    account.startingBalance + deposits.contributionsThrough - withdrawnBefore + adjustmentsThrough;
  const earmarkTargets = recurringGroups.filter((g) => g.id !== savingsGroup?.id);

  // The savings balance as a running series: the tracker's own flows (deposits in,
  // earmarks out) plus anything entered by hand, bucketed by day/week/month.
  const trendEvents = [...flowEvents, ...adjustments.events].sort((a, b) => a.date.localeCompare(b.date));
  const trendBuckets = buildSavingsBuckets(
    trendEvents,
    account.startingBalance,
    granularity,
    monthBounds.start_date,
    account.startMonth,
    toISODate(new Date())
  );
  const selectGranularity = (g: SavingsGranularity) => {
    setGranularity(g);
    localStorage.setItem(TREND_KEY, g);
  };
  /** Editing a bucket's balance stores the difference as an adjustment on its last day. */
  const setTrendBalance = (bucket: SavingsBucket, target: number) =>
    void adjustments.adjustBalanceAt(bucket.end, target - bucket.balance);

  if (view === 'snapshot') {
    const nextMonthStart = shiftCursor('monthly', monthCursor, 1);
    const upcoming = [...buildEvents(monthBounds.start_date), ...buildEvents(periodForCursor('monthly', nextMonthStart).start_date)]
      .filter((e) => e.date >= todayISO)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    return (
      <BudgetSnapshot
        monthLabel={monthBounds.label}
        onPrevMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, -1))}
        onNextMonth={() => setMonthCursor((c) => shiftCursor('monthly', c, 1))}
        monthlyIncome={monthlyIncome}
        cardsWeeklySuggested={cardsWeeklySuggested}
        cardsRemainingTotal={cardsRemainingTotal}
        savingsBalance={savingsAvailable - savings.allocated}
        startingBalance={account.startingBalance}
        startMonthLabel={monthLabelOf(account.startMonth)}
        savedThisMonth={deposits.monthTotal}
        earmarkedThisMonth={savings.allocated}
        adjustedThisMonth={adjustedThisMonth}
        upcoming={upcoming}
        savingsTrend={
          <SavingsTrend
            granularity={granularity}
            onGranularityChange={selectGranularity}
            buckets={trendBuckets}
            events={trendEvents}
            onSetBalance={setTrendBalance}
            adjustments={adjustments.adjustments.filter(
              (a) =>
                trendBuckets.length > 0 &&
                a.adj_date >= trendBuckets[0].start &&
                a.adj_date <= trendBuckets[trendBuckets.length - 1].end
            )}
            onAddAdjustment={(date, amount, note) => void adjustments.addAdjustment(date, amount, note)}
            onDeleteAdjustment={(id) => void adjustments.deleteAdjustment(id)}
          />
        }
      />
    );
  }

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
        weeks={weeks}
        grossMonthlyOf={grossMonthlyOf}
        grossWeeklyOf={grossWeeklyOf}
        savingsMonthlyOf={savingsMonthlyOf}
        onSaveWeekly={saveWeekly}
        onSaveMonthly={saveMonthly}
        onAddGroup={groupsApi.addGroup}
        onRename={(id, name) => void groupsApi.updateGroup(id, { name })}
        onDelete={groupsApi.deleteGroup}
        onSetDueDay={(id, day) => void groupsApi.updateGroup(id, { due_day: day })}
        onSetFloatSavings={(id, on) => void groupsApi.updateGroup(id, { float_savings: on })}
        overrideFor={overrides.overrideFor}
        defaultMonthlyOf={defaultMonthlyOf}
        onSetOverride={(id, amount, note) => void overrides.setOverride(id, amount, note)}
        onClearOverride={(id) => void overrides.clearOverride(id)}
        breakdown={
          <AllocationBreakdown
            allocation={{
              // Bills: every recurring group at its resolved (override-aware)
              // monthly amount. Credit cards: the weekly payoff pace spread over
              // the month's weeks. Savings pool: this month's pool total.
              bills: recurringGroups.reduce((s, g) => s + resolvedMonthlyOf(g), 0),
              creditCards: cardsWeeklySuggested * weeks,
              savingsPool: savings.totalSaved,
              income: monthlyIncome,
            }}
          />
        }
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
        adjustmentsTotal={adjustmentsThrough}
        available={savingsAvailable}
        allocated={savings.allocated}
        earmarkAmounts={savings.earmarkAmounts}
        onSetEarmark={savings.setEarmark}
        scheduledExpenses={scheduledThisMonth.map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount) || 0 }))}
        expenseEarmarkAmounts={savings.expenseEarmarkAmounts}
        onSetExpenseEarmark={savings.setExpenseEarmark}
      />

    </>
  );
}

/** "July 2026" from a YYYY-MM-DD (first-of-month) string. */
function monthLabelOf(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
