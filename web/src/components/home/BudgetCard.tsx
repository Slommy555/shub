import { formatMoney } from '../../types/budget';
import { useHomeBudget } from '../../hooks/useHomeBudget';
import { Card, CardSkeleton, SectionHeader } from './parts';

/** One of the three monthly totals, shown big enough to read at a glance. */
function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl px-3 py-2.5"
      style={{ background: 'var(--color-bg-surface)' }}
    >
      <span
        className="truncate text-[11px] font-medium uppercase"
        style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <span
        className="truncate text-[20px] font-semibold tabular-nums"
        style={{ color: color ?? 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}

/** One term of the headline equation: a big number over a quiet caption. */
function Term({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span
        className="truncate text-[24px] font-bold leading-none tabular-nums sm:text-[32px]"
        style={{ color: color ?? 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
      >
        {formatMoney(value)}
      </span>
      <span className="mt-1.5 truncate text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
    </div>
  );
}

/** The − and = between the terms, sitting on the numbers' line. */
function Op({ children }: { children: string }) {
  return (
    <span
      // Nudged down so the smaller glyph sits on the numbers' line, not above it.
      className="shrink-0 pt-[2px] text-[20px] font-medium leading-none sm:pt-[4px] sm:text-[26px]"
      style={{ color: 'var(--color-text-tertiary)' }}
    >
      {children}
    </span>
  );
}

/**
 * This pay week's headroom up top, then where the week's money goes. The
 * figures are deliberately large — this card exists to be read from arm's length.
 */
export default function BudgetCard({
  userId,
  onOpenBudget,
  className = '',
}: {
  userId: string;
  onOpenBudget: () => void;
  className?: string;
}) {
  const b = useHomeBudget(userId);

  if (!b.ready) return <CardSkeleton rows={2} className={className} />;

  return (
    <Card onClick={onOpenBudget} className={className}>
      <SectionHeader
        title="Budget"
        meta={
          b.payDayNumber > 0
            ? `Week of ${b.weekLabel} · paycheck ${b.payDayNumber} of ${b.payDayCount}`
            : `Week of ${b.weekLabel}`
        }
      />

      {/* The week as one equation: paycheck − what's put away = what's left. */}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-3">
        <Term label="paycheck" value={b.income} />
        <Op>−</Op>
        <Term label="put away" value={b.setAside} />
        <Op>=</Op>
        <Term
          label="left over"
          value={b.weekLeft}
          color={b.weekLeft >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
      </div>

      {/* Where this week's money goes. All three are weekly. */}
      <div className="mt-auto flex gap-2 pt-4">
        <Stat label="Fixed expenses" value={b.billsWeekly} />
        <Stat label="Credit cards" value={b.creditWeekly} />
        <Stat label="To savings" value={b.savingsWeekly} color="var(--color-success)" />
      </div>
    </Card>
  );
}
