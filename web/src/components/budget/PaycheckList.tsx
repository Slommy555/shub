import { useState } from 'react';
import { formatMoney, parseMoney, type BudgetGroup, type ScheduledExpense } from '../../types/budget';
import type { PayDay } from '../../hooks/budget/usePayDayIncomes';
import type { SavingsDeposit } from '../../hooks/budget/useSavingsDeposits';

interface Props {
  /** Expense groups (the "Savings" category is handled by the deposit field). */
  groups: BudgetGroup[];
  /** The month's pay-day Thursdays (each with its own weekly income). */
  payDays: PayDay[];
  onSetPayDayIncome: (thursday: string, n: number) => void;
  /** Set-aside for a group on a specific pay-day Thursday (card window-aware). */
  weeklyOnDate: (g: BudgetGroup, thursdayISO: string) => number;
  /** How much of a group's weekly amount is already covered by savings. */
  coveredOf: (g: BudgetGroup) => number;
  /** This month's savings deposits, so the current pay day's can be edited here. */
  deposits: SavingsDeposit[];
  onSetDeposit: (weekStart: string, n: number) => void;
  /** Scheduled (one-off) expenses the user assigned to a given pay date. */
  scheduledForDate?: (thursdayISO: string) => ScheduledExpense[];
}

/**
 * Paycheck view: a single-paycheck waterfall. Cycle between the month's pay days
 * to see each week's income and how it gets divided. You can put money into
 * savings for this pay day right here; each expense's set-aside is net of any
 * savings earmarked toward it (fully-covered → hidden). Credit-card payments only
 * appear on pay days inside the card's payoff window.
 */
export default function PaycheckList({
  groups,
  payDays,
  onSetPayDayIncome,
  weeklyOnDate,
  coveredOf,
  deposits,
  onSetDeposit,
  scheduledForDate,
}: Props) {
  const [idx, setIdx] = useState(0);
  const clamped = payDays.length === 0 ? 0 : Math.min(idx, payDays.length - 1);
  const current = payDays[clamped];
  const income = current?.income ?? 0;
  const savingsDeposit = deposits.find((d) => d.date === current?.date)?.amount ?? 0;

  // The waterfall: recurring group set-asides (net of savings) plus any one-off
  // scheduled expenses the user pinned to this pay date. Fully-covered / $0 hidden.
  const groupRows = groups.map((g) => ({
    key: g.id,
    name: g.name,
    color: g.color,
    setAside: current ? Math.max(0, weeklyOnDate(g, current.date) - coveredOf(g)) : 0,
    note: undefined as string | undefined,
  }));
  const scheduledRows = (current ? scheduledForDate?.(current.date) ?? [] : []).map((e) => ({
    key: e.id,
    name: e.name,
    color: '#f0a04b',
    setAside: Number(e.amount) || 0,
    note: 'one-time' as string | undefined,
  }));
  const rows = [...groupRows, ...scheduledRows].filter((r) => r.setAside > 0);

  const totalSetAside = savingsDeposit + rows.reduce((sum, r) => sum + r.setAside, 0);
  const leftOver = income - totalSetAside;

  let running = income - savingsDeposit;

  return (
    <div>
      {/* Pay-day navigator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous pay day"
          onClick={() => setIdx(Math.max(0, clamped - 1))}
          disabled={clamped <= 0}
          className="grid h-11 w-11 place-items-center rounded-xl border active:opacity-80 disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {current?.label ?? 'Pay day'}
          </span>
          <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            Paycheck {payDays.length ? clamped + 1 : 0} of {payDays.length}
          </span>
        </div>
        <button
          type="button"
          aria-label="Next pay day"
          onClick={() => setIdx(Math.min(payDays.length - 1, clamped + 1))}
          disabled={clamped >= payDays.length - 1}
          className="grid h-11 w-11 place-items-center rounded-xl border active:opacity-80 disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* This paycheck's income */}
      <MoneyField
        key={`inc-${current?.date ?? 'none'}`}
        label="This paycheck's income"
        big
        value={income}
        onSave={(n) => current && onSetPayDayIncome(current.date, n)}
      />

      {/* Put money into savings this pay day */}
      <div
        className="mb-4 rounded-2xl border p-4"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
            Add to savings
          </span>
          <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
            Remaining {formatMoney(income - savingsDeposit)}
          </span>
        </div>
        <MoneyField
          key={`sav-${current?.date ?? 'none'}`}
          value={savingsDeposit}
          onSave={(n) => current && onSetDeposit(current.date, n)}
        />
      </div>

      {/* Group waterfall */}
      {rows.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-2xl border px-4 py-8 text-center text-[15px]"
          style={{
            background: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Nothing else to set aside this week
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((item) => {
            running -= item.setAside;
            const remainingAfter = running;
            return (
              <div
                key={item.key}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.color }} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                    {item.name}
                  </span>
                  {item.note && (
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-text-secondary)', letterSpacing: '0.04em' }}
                    >
                      {item.note}
                    </span>
                  )}
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Set aside
                    </span>
                    <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
                      {formatMoney(item.setAside)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Remaining after
                    </span>
                    <span
                      className="text-lg font-semibold tabular-nums"
                      style={{ color: remainingAfter >= 0 ? 'var(--color-text-primary)' : 'var(--color-danger)', letterSpacing: '-0.02em' }}
                    >
                      {formatMoney(remainingAfter)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div className="mt-4 rounded-2xl border p-4" style={{ background: 'var(--color-bg-overlay)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between py-1">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Total set aside {savingsDeposit > 0 ? '(incl. savings)' : ''}
          </span>
          <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {formatMoney(totalSetAside)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Left over
          </span>
          <span
            className="text-xl font-bold tabular-nums"
            style={{ color: leftOver >= 0 ? 'var(--color-success)' : 'var(--color-danger)', letterSpacing: '-0.02em' }}
          >
            {formatMoney(leftOver)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Currency input (raw while focused). `big` renders the large income style. */
function MoneyField({
  value,
  onSave,
  label,
  big = false,
}: {
  value: number;
  onSave: (n: number) => void;
  label?: string;
  big?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';
  return (
    <div className={big ? 'mb-4' : ''}>
      {label && (
        <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
      )}
      <input
        inputMode="decimal"
        placeholder="$0"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setText(value ? String(value) : '');
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          onSave(parseMoney(text));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={`w-full rounded-xl border px-4 tabular-nums outline-none ${big ? 'text-2xl font-bold' : 'text-lg font-semibold'}`}
        style={{
          height: big ? '56px' : '48px',
          background: 'var(--color-bg-surface)',
          borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}
