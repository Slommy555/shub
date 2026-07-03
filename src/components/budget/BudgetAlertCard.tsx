import type { BudgetAlert } from '../../hooks/budget/useBudgetMetrics';
import { formatMoney } from '../../lib/budget';

/** A single budget alert (amber = nearing limit, red = over). */
export default function BudgetAlertCard({
  alert,
  currency,
}: {
  alert: BudgetAlert;
  currency: string;
}) {
  const over = alert.level === 'over';
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl border p-3',
        over
          ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10'
          : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10',
      ].join(' ')}
    >
      <span className="text-lg">{over ? '🚨' : '⚠️'}</span>
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-semibold ${over ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
          {alert.name} {over ? 'over budget' : 'nearing limit'}
        </p>
        <p className={`text-xs ${over ? 'text-red-700/80 dark:text-red-400/80' : 'text-amber-700/80 dark:text-amber-400/80'}`}>
          {formatMoney(alert.spent, currency)} of {formatMoney(alert.limit, currency)} ({Math.round(alert.ratio * 100)}%)
        </p>
      </div>
    </div>
  );
}
