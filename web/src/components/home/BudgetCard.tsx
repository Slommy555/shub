import { formatMoney } from '../../types/budget';
import { useHomeBudget } from '../../hooks/useHomeBudget';
import { Card, CardSkeleton, SectionHeader } from './parts';

/** Two compact rows: this week's headroom, then where the month is committed. */
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
      <SectionHeader title="Budget" />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[17px] font-semibold tabular-nums" style={{ letterSpacing: '-0.02em' }}>
          <span style={{ color: 'var(--color-text-primary)' }}>This week: </span>
          <span style={{ color: b.weekLeft >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
            {formatMoney(b.weekLeft)} left
          </span>
        </span>
        <span className="text-[13px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
          Set aside: {formatMoney(b.setAside)} / {formatMoney(b.setAsideNeeded)} needed
        </span>
      </div>

      <p className="mt-auto pt-2 text-[13px] tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
        Bills {formatMoney(b.bills)} &nbsp;•&nbsp; Credit {formatMoney(b.creditCards)} &nbsp;•&nbsp;
        Savings {formatMoney(b.savingsPool)}
      </p>
    </Card>
  );
}
