import { formatMoney } from '../../lib/budget';

interface Weekly {
  spent: number;
  saved: number;
  spendingLimit: number | null;
  savingsTarget: number | null;
}

function Bar({ pct, tone }: { pct: number; tone: string }) {
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
      <div
        className={`h-full rounded-full transition-[width] ${tone}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

/**
 * "This week" pacing card: current-week expenses against the weekly spending
 * limit, and current-week savings against the weekly savings goal. Only the
 * rows that have a limit/goal set are shown (the card itself renders only when
 * at least one is set). Amounts are for the current week (per the user's week
 * start preference).
 */
export default function WeeklyLimitsCard({
  weekly,
  currency,
}: {
  weekly: Weekly;
  currency: string;
}) {
  const { spent, saved, spendingLimit, savingsTarget } = weekly;

  const spendPct = spendingLimit && spendingLimit > 0 ? (spent / spendingLimit) * 100 : 0;
  const spendTone =
    spendPct >= 100 ? 'bg-red-500' : spendPct >= 80 ? 'bg-amber-500' : 'bg-green-500';
  const spendLeft = (spendingLimit ?? 0) - spent;

  const savePct = savingsTarget && savingsTarget > 0 ? (saved / savingsTarget) * 100 : 0;
  const saveMet = savingsTarget != null && saved >= savingsTarget;
  const saveLeft = (savingsTarget ?? 0) - saved;

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">This week</p>

      {spendingLimit != null && (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Spending</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400">
              {formatMoney(spent, currency)} <span className="text-gray-300 dark:text-gray-600">/</span>{' '}
              {formatMoney(spendingLimit, currency)}
            </span>
          </div>
          <Bar pct={spendPct} tone={spendTone} />
          <p
            className={[
              'mt-1 text-[11px] font-medium',
              spendLeft < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400',
            ].join(' ')}
          >
            {spendLeft < 0
              ? `${formatMoney(-spendLeft, currency)} over limit`
              : `${formatMoney(spendLeft, currency)} left`}
          </p>
        </div>
      )}

      {savingsTarget != null && (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">Savings</span>
            <span className="tabular-nums text-gray-500 dark:text-gray-400">
              {formatMoney(saved, currency)} <span className="text-gray-300 dark:text-gray-600">/</span>{' '}
              {formatMoney(savingsTarget, currency)}
            </span>
          </div>
          <Bar pct={savePct} tone={saveMet ? 'bg-green-500' : 'bg-indigo-500'} />
          <p
            className={[
              'mt-1 text-[11px] font-medium',
              saveMet ? 'text-green-600 dark:text-green-400' : 'text-gray-400',
            ].join(' ')}
          >
            {saveMet ? 'Goal reached 🎉' : `${formatMoney(saveLeft, currency)} to go`}
          </p>
        </div>
      )}
    </div>
  );
}
