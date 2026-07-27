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

  // Income
  monthlyIncome: number;
  weeklyIncome: number;
  payDayCount: number;

  // Where it goes
  recurringNetMonthly: number;
  scheduledTotal: number;
  cardsWeeklySuggested: number;
  cardsRemainingTotal: number;
  monthlyAllocated: number;
  monthlyRemaining: number;
  savingsCovering: number;

  // Savings
  savingsBalance: number;
  startingBalance: number;
  startMonthLabel: string;
  savedThisMonth: number;
  earmarkedThisMonth: number;

  history: HistoryMonth[];
  /** The next few dated events from today forward. */
  upcoming: UpcomingItem[];
}

/** "Thu, Jul 30" from YYYY-MM-DD. */
function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** A big headline number with a caption. */
function Tile({ label, value, tone, note }: { label: string; value: number; tone?: 'good' | 'bad'; note?: string }) {
  const color =
    tone === 'good' ? 'var(--color-success)' : tone === 'bad' ? 'var(--color-danger)' : 'var(--color-text-primary)';
  return (
    <div className="rounded-2xl border p-3.5" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
      <span className="mb-1 block text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <span className="block text-[22px] font-bold tabular-nums" style={{ color, letterSpacing: '-0.03em' }}>
        {formatMoney(value)}
      </span>
      {note && (
        <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {note}
        </span>
      )}
    </div>
  );
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
 * At-a-glance rundown for the month in view: what's coming in, where it's
 * committed, what's left, and how savings is actually tracking (added vs pulled
 * back out) against the last six months.
 */
export default function BudgetSnapshot({
  monthLabel,
  onPrevMonth,
  onNextMonth,
  monthlyIncome,
  weeklyIncome,
  payDayCount,
  recurringNetMonthly,
  scheduledTotal,
  cardsWeeklySuggested,
  cardsRemainingTotal,
  monthlyAllocated,
  monthlyRemaining,
  savingsCovering,
  savingsBalance,
  startingBalance,
  startMonthLabel,
  savedThisMonth,
  earmarkedThisMonth,
  history,
  upcoming,
}: Props) {
  const committedPct = monthlyIncome > 0 ? Math.min(100, (monthlyAllocated / monthlyIncome) * 100) : 0;
  const savingsRate = monthlyIncome > 0 ? (savedThisMonth / monthlyIncome) * 100 : 0;
  const netSavings = savedThisMonth - earmarkedThisMonth;
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

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Income"
          value={monthlyIncome}
          note={`${payDayCount} paycheck${payDayCount === 1 ? '' : 's'} · ${formatMoney(weeklyIncome)} avg`}
        />
        <Tile label="Committed" value={monthlyAllocated} note={`${Math.round(committedPct)}% of income`} />
        <Tile
          label="Left over"
          value={monthlyRemaining}
          tone={monthlyRemaining < 0 ? 'bad' : 'good'}
          note={monthlyRemaining < 0 ? 'over budget' : 'unspoken for'}
        />
        <Tile label="Savings" value={savingsBalance} note={`${formatMoney(savedThisMonth)} added this month`} />
      </div>

      {/* Committed vs income bar */}
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--color-bg-surface)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${committedPct}%`, background: monthlyRemaining < 0 ? 'var(--color-danger)' : 'var(--color-accent)' }}
        />
      </div>

      <Card title="Where it goes">
        <Line label="Recurring fixed costs" value={recurringNetMonthly} note="net of savings" />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Scheduled expenses" value={scheduledTotal} note="this month" />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Card payoff pace" value={cardsWeeklySuggested * 4} note={`${formatMoney(cardsWeeklySuggested)}/wk`} />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Left over" value={monthlyRemaining} tone={monthlyRemaining < 0 ? 'bad' : 'good'} />
        {savingsCovering > 0 && (
          <>
            <div style={{ borderTop: '1px solid var(--color-border)' }} />
            <Line label="Savings covering" value={savingsCovering} note="paid from the pool" tone="good" />
          </>
        )}
      </Card>

      <Card title="Savings growth">
        <Line label="Added this month" value={savedThisMonth} note={`${Math.round(savingsRate)}% of income`} tone="good" />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Earmarked out" value={earmarkedThisMonth} note="spent from the pool" tone="muted" />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Net change" value={netSavings} tone={netSavings < 0 ? 'bad' : 'good'} />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Line label="Balance" value={savingsBalance} note={`from ${formatMoney(startingBalance)} in ${startMonthLabel}`} />
      </Card>

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
