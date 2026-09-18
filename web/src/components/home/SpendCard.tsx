import { formatMoney } from '../../lib/spend';
import type { SpendEntry } from '../../types/spend';
import { Card, SectionHeader } from './parts';

/**
 * Today's spend at a glance, with the last thing logged underneath. The whole
 * card opens the Spend tab.
 *
 * HomeTab owns the query and leaves the tile out entirely on a day with nothing
 * logged, so this only ever renders with a `last` entry to show.
 */
export default function SpendCard({
  total,
  last,
  onOpenSpend,
}: {
  total: number;
  last: SpendEntry;
  onOpenSpend: () => void;
}) {
  return (
    <Card onClick={onOpenSpend}>
      <SectionHeader title="Spend" />

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
          Today
        </span>
        <span
          className="shrink-0 text-[24px] font-bold tabular-nums"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
        >
          {formatMoney(total)}
        </span>
      </div>

      <div className="mt-auto flex items-baseline justify-between gap-3 pt-3">
        <span
          className="min-w-0 flex-1 truncate text-[13px]"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {last.label || 'No label'}
        </span>
        <span
          className="shrink-0 text-[13px] tabular-nums"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {formatMoney(Number(last.amount))}
        </span>
      </div>
    </Card>
  );
}
