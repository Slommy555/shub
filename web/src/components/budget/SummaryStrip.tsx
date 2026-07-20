import { formatMoney } from '../../types/budget';

export interface BudgetSummary {
  income: number;
  /** total earmarked from the savings pool across all groups */
  fromSavings: number;
  /** sum of max(0, group.amount − earmark) — what must come from income */
  needsFunding: number;
  /** income − needsFunding */
  remaining: number;
}

/**
 * Income · From Savings · Needs Funding · Remaining — a 2×2 grid. Remaining is
 * green when positive, red when negative; From Savings is shown in success green.
 */
export default function SummaryStrip({ summary }: { summary: BudgetSummary }) {
  const remainingColor = summary.remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

  const Cell = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex flex-col items-center gap-1 py-1">
      <span
        className="text-2xl font-bold tabular-nums"
        style={{ color: color ?? 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
    </div>
  );

  return (
    <div
      className="mb-6 grid grid-cols-2 gap-y-4 rounded-2xl border p-4"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <Cell label="Income" value={formatMoney(summary.income)} />
      <Cell label="From Savings" value={formatMoney(summary.fromSavings)} color="var(--color-success)" />
      <Cell label="Needs Funding" value={formatMoney(summary.needsFunding)} />
      <Cell label="Remaining" value={formatMoney(summary.remaining)} color={remainingColor} />
    </div>
  );
}
