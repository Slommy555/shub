import { formatMoney } from '../../types/budget';

export interface Allocation {
  /** Sum of every recurring group's resolved monthly amount. */
  bills: number;
  /** Sum of the cards' weekly payments × the weeks in this period. */
  creditCards: number;
  /** budget_savings_pools.total_saved for this budget + month. */
  savingsPool: number;
  /** Income for the month — the number Remaining is measured against. */
  income: number;
}

function Row({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: number;
  strong?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <span
        className={strong ? 'text-[15px] font-semibold' : 'text-[15px]'}
        style={{ color: strong ? 'var(--color-text-primary)' : 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      <span
        className={`shrink-0 tabular-nums ${strong ? 'text-[17px] font-semibold' : 'text-[15px] font-medium'}`}
        style={{ color: color ?? 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
      >
        {formatMoney(value)}
      </span>
    </div>
  );
}

/**
 * Where the month's income goes, ending in what's left. Every input is derived
 * from the same live hooks the rest of the tab reads, so editing an amount, a
 * card balance or the savings pool updates this immediately.
 *
 * Total Allocated = Bills + Credit Cards + Savings Pool; Remaining = income − that.
 */
export default function AllocationBreakdown({ allocation }: { allocation: Allocation }) {
  const totalAllocated = allocation.bills + allocation.creditCards + allocation.savingsPool;
  const remaining = allocation.income - totalAllocated;

  return (
    <div className="mb-5">
      <h2
        className="mb-2 text-[11px] font-semibold uppercase"
        style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
      >
        Where it goes
      </h2>
      <div
        className="rounded-2xl border px-4 py-1.5"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
      >
        <Row label="Bills (Recurring)" value={allocation.bills} />
        <Row label="Credit Cards" value={allocation.creditCards} />
        <Row label="Savings Pool" value={allocation.savingsPool} />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Row label="Total Allocated" value={totalAllocated} strong />
        <div style={{ borderTop: '1px solid var(--color-border)' }} />
        <Row
          label="Remaining"
          value={remaining}
          strong
          color={remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}
        />
      </div>
    </div>
  );
}
