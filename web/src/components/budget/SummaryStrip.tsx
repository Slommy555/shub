import { formatMoney } from '../../types/budget';
import type { BudgetSummary } from '../../hooks/budget/useBudgetSummary';

/** Income · Spent · Remaining — three equal columns, numbers centered. */
export default function SummaryStrip({ summary }: { summary: BudgetSummary }) {
  const remainingColor = summary.remaining >= 0 ? 'var(--color-success)' : 'var(--color-danger)';

  const Cell = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div className="flex flex-1 flex-col items-center gap-1">
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
      className="mb-6 flex items-stretch rounded-2xl border p-4"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <Cell label="Income" value={formatMoney(summary.income)} />
      <Cell label="Spent" value={formatMoney(summary.spent)} />
      <Cell label="Remaining" value={formatMoney(summary.remaining)} color={remainingColor} />
    </div>
  );
}
