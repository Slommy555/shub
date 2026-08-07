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

/**
 * This pay week's headroom up top, then where the month is committed. The
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

  const shortfall = b.setAsideNeeded - b.setAside;

  return (
    <Card onClick={onOpenBudget} className={className}>
      <SectionHeader title="Budget" meta={`Week of ${b.weekLabel}`} />

      {/* Hero: what's left after this pay week's set-asides. */}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col">
          <span
            className="text-[32px] font-bold leading-none tabular-nums"
            style={{
              color: b.weekLeft >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              letterSpacing: '-0.02em',
            }}
          >
            {formatMoney(b.weekLeft)}
          </span>
          <span className="mt-1.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            left this week
          </span>
        </div>

        <div className="flex min-w-0 flex-col sm:items-end">
          <span
            className="text-[24px] font-semibold leading-none tabular-nums"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
          >
            {formatMoney(b.setAside)}
            <span className="text-[17px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {' / '}
              {formatMoney(b.setAsideNeeded)}
            </span>
          </span>
          <span className="mt-1.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            set aside
            {shortfall > 0.5 && (
              <span style={{ color: 'var(--color-warning)' }}>
                {' '}
                · {formatMoney(shortfall)} short
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Where the month is committed. */}
      <div className="mt-auto flex gap-2 pt-4">
        <Stat label="Bills" value={b.bills} />
        <Stat label="Credit" value={b.creditCards} />
        <Stat label="Savings" value={b.savingsPool} color="var(--color-success)" />
      </div>
    </Card>
  );
}
