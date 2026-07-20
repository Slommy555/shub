import { useState } from 'react';
import { formatMoney, parseMoney, type BudgetGroup } from '../../types/budget';
import type { PayDay } from '../../hooks/budget/usePayDayIncomes';

interface Props {
  groups: BudgetGroup[];
  /** The month's pay-day Thursdays (each with its own weekly income). */
  payDays: PayDay[];
  onSetPayDayIncome: (thursday: string, n: number) => void;
  /** The amount to set aside for a group from one paycheck (its weekly amount). */
  weeklyOf: (g: BudgetGroup) => number;
  /** How much of a group's weekly amount is already covered by savings. */
  coveredOf: (g: BudgetGroup) => number;
}

/**
 * Paycheck view: a single-paycheck waterfall. Cycle between the month's pay days
 * to see each week's income and how the weekly expenses stack against it. Each
 * group's set-aside is net of any savings earmarked toward it — a fully-covered
 * group drops out of the list.
 */
export default function PaycheckList({ groups, payDays, onSetPayDayIncome, weeklyOf, coveredOf }: Props) {
  const [idx, setIdx] = useState(0);
  const clamped = payDays.length === 0 ? 0 : Math.min(idx, payDays.length - 1);
  const current = payDays[clamped];
  const income = current?.income ?? 0;

  // Net set-aside per group after savings; fully-covered groups are hidden.
  const rows = groups
    .map((g) => ({ g, setAside: Math.max(0, weeklyOf(g) - coveredOf(g)) }))
    .filter((r) => r.setAside > 0);

  const totalSetAside = rows.reduce((sum, r) => sum + r.setAside, 0);
  const leftOver = income - totalSetAside;

  let running = income;

  return (
    <div>
      {/* Pay-day navigator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous pay day"
          onClick={() => setIdx(Math.max(0, clamped - 1))}
          disabled={clamped <= 0}
          className="grid h-11 w-11 place-items-center rounded-full border active:opacity-80 disabled:opacity-40"
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
          className="grid h-11 w-11 place-items-center rounded-full border active:opacity-80 disabled:opacity-40"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* This paycheck's income */}
      <PaycheckIncomeField
        key={current?.date ?? 'none'}
        value={income}
        onSave={(n) => current && onSetPayDayIncome(current.date, n)}
      />

      {/* Group waterfall */}
      {rows.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-2xl border px-4 py-10 text-center text-[15px]"
          style={{
            background: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          Nothing to set aside this week
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(({ g, setAside }) => {
            running -= setAside;
            const remainingAfter = running;
            return (
              <div
                key={g.id}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                  <span
                    className="min-w-0 flex-1 truncate text-[15px] font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {g.name}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Set aside
                    </span>
                    <span
                      className="text-lg font-semibold tabular-nums"
                      style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
                    >
                      {formatMoney(setAside)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Remaining after
                    </span>
                    <span
                      className="text-lg font-semibold tabular-nums"
                      style={{
                        color: remainingAfter >= 0 ? 'var(--color-text-primary)' : 'var(--color-danger)',
                        letterSpacing: '-0.02em',
                      }}
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
      <div
        className="mt-4 rounded-2xl border p-4"
        style={{ background: 'var(--color-bg-overlay)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between py-1">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Total to set aside
          </span>
          <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {formatMoney(totalSetAside)}
          </span>
        </div>
        <div
          className="mt-2 flex items-center justify-between border-t pt-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Left over
          </span>
          <span
            className="text-xl font-bold tabular-nums"
            style={{
              color: leftOver >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              letterSpacing: '-0.02em',
            }}
          >
            {formatMoney(leftOver)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Large currency input for the selected paycheck (raw while focused). */
function PaycheckIncomeField({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';
  return (
    <div className="mb-5">
      <label
        htmlFor="paycheck-income"
        className="mb-2 block text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        This paycheck's income
      </label>
      <input
        id="paycheck-income"
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
        className="w-full rounded-xl border px-4 text-2xl font-bold tabular-nums outline-none"
        style={{
          height: '56px',
          background: 'var(--color-bg-surface)',
          borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}
