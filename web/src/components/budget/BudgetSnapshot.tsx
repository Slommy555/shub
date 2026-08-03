import { formatMoney } from '../../types/budget';
import type { HistoryMonth } from '../../hooks/budget/useBudgetHistory';

export interface UpcomingItem {
  date: string; // YYYY-MM-DD
  label: string;
  amount: number;
  color: string;
  kind: 'pay' | 'fixed' | 'scheduled' | 'card';
}

interface Props {
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;

  // Income — still the denominator for the savings-rate note.
  monthlyIncome: number;

  // Debt
  cardsWeeklySuggested: number;
  cardsRemainingTotal: number;

  // Savings
  savingsBalance: number;
  startingBalance: number;
  startMonthLabel: string;
  savedThisMonth: number;
  earmarkedThisMonth: number;
  /** Net of this month's hand adjustments — money the tracker never saw. */
  adjustedThisMonth: number;

  history: HistoryMonth[];
  /** The next few dated events from today forward. */
  upcoming: UpcomingItem[];
  /** The savings balance chart + its editors (see SavingsTrend). */
  savingsTrend?: React.ReactNode;
}

/** "Thu, Jul 30" from YYYY-MM-DD. */
function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** One line of a breakdown list. */
function Line({ label, value, note, tone }: { label: string; value: number; note?: string; tone?: 'good' | 'bad' | 'muted' }) {
  const color =
    tone === 'good' ? 'var(--color-success)' : tone === 'bad' ? 'var(--color-danger)' : tone === 'muted' ? 'var(--color-text-secondary)' : 'var(--color-text-primary)';
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span className="min-w-0 text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
        {label}
        {note && (
          <span className="ml-1.5 text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {note}
          </span>
        )}
      </span>
      <span className="shrink-0 text-[15px] font-semibold tabular-nums" style={{ color, letterSpacing: '-0.02em' }}>
        {formatMoney(value)}
      </span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h2 className="mb-2 text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
        {title}
      </h2>
      <div className="rounded-2xl border px-4 py-1.5" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
        {children}
      </div>
    </div>
  );
}

/**
 * How savings is actually tracking for the month in view — added vs pulled back
 * out, the running balance, and the last six months of income vs saved. The
 * month's funding progress lives above this in SetAsideSnapshot.
 */
export default function BudgetSnapshot({
  monthLabel,
  onPrevMonth,
  onNextMonth,
  monthlyIncome,
  cardsWeeklySuggested,
  cardsRemainingTotal,
  savingsBalance,
  startingBalance,
  startMonthLabel,
  savedThisMonth,
  earmarkedThisMonth,
  adjustedThisMonth,
  history,
  upcoming,
  savingsTrend,
}: Props) {
  const savingsRate = monthlyIncome > 0 ? (savedThisMonth / monthlyIncome) * 100 : 0;
  const netSavings = savedThisMonth - earmarkedThisMonth + adjustedThisMonth;
  const peak = Math.max(1, ...history.map((h) => Math.max(h.income, h.saved)));
  const avgSaved = history.length > 0 ? history.reduce((s, h) => s + h.saved, 0) / history.length : 0;

  return (
    <div>
      {/* Month navigator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={onPrevMonth}
          className="grid h-11 w-11 place-items-center rounded-xl border active:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
          {monthLabel}
        </span>
        <button
          type="button"
          aria-label="Next month"
          onClick={onNextMonth}
          className="grid h-11 w-11 place-items-center rounded-xl border active:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <Card title="Savings growth">
        <Line label="Added this month" value={savedThisMonth} note={`${Math.round(savingsRate)}% of income`} tone="good" />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Earmarked out" value={earmarkedThisMonth} note="spent from the pool" tone="muted" />
        {adjustedThisMonth !== 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--color-border)' }} />
            <Line
              label="Adjustments"
              value={adjustedThisMonth}
              note="off the tracker"
              tone={adjustedThisMonth < 0 ? 'bad' : 'good'}
            />
          </>
        )}
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Net change" value={netSavings} tone={netSavings < 0 ? 'bad' : 'good'} />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Balance" value={savingsBalance} note={`from ${formatMoney(startingBalance)} in ${startMonthLabel}`} />
      </Card>

      {savingsTrend}

      {/* Six-month income vs saved */}
      {history.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
              Last {history.length} months
            </h2>
            <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {formatMoney(avgSaved)}/mo saved avg
            </span>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
            <div className="flex items-end justify-between gap-2" style={{ height: 108 }}>
              {history.map((h) => (
                <div key={h.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-full w-full items-end justify-center gap-[3px]">
                    <div
                      className="w-1/2 rounded-t-[3px]"
                      title={`${h.label} income ${formatMoney(h.income)}`}
                      style={{ height: `${(h.income / peak) * 100}%`, minHeight: h.income > 0 ? 3 : 0, background: 'var(--color-border-strong)' }}
                    />
                    <div
                      className="w-1/2 rounded-t-[3px]"
                      title={`${h.label} saved ${formatMoney(h.saved)}`}
                      style={{ height: `${(h.saved / peak) * 100}%`, minHeight: h.saved > 0 ? 3 : 0, background: 'var(--color-success)' }}
                    />
                  </div>
                  <span className="text-[10px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    {h.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-border-strong)' }} />
                Income
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: 'var(--color-success)' }} />
                Saved
              </span>
            </div>
          </div>
        </div>
      )}

      {cardsRemainingTotal > 0 && (
        <Card title="Debt">
          <Line label="Card balances owed" value={cardsRemainingTotal} note={`${formatMoney(cardsWeeklySuggested)}/wk to clear`} tone="bad" />
        </Card>
      )}

      {upcoming.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
            Coming up
          </h2>
          <div className="flex flex-col gap-2">
            {upcoming.map((u, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: u.color }} />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {u.label}
                </span>
                <span className="shrink-0 text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {dayLabel(u.date)}
                </span>
                <span
                  className="shrink-0 text-[15px] font-semibold tabular-nums"
                  style={{ color: u.kind === 'pay' ? 'var(--color-success)' : 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
                >
                  {u.kind === 'pay' ? '+' : ''}
                  {formatMoney(u.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
