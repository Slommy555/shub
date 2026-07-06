import { useBudgetMetrics } from '../../hooks/budget/useBudgetMetrics';
import type { BudgetCategory, BudgetSettings, BudgetTransaction } from '../../types/budget';
import { formatMoney } from '../../lib/budget';
import BudgetAlertCard from './BudgetAlertCard';
import WeeklyLimitsCard from './WeeklyLimitsCard';
import SpendingChart from './SpendingChart';
import WeeklyTrendChart from './WeeklyTrendChart';
import MonthlyTrendChart from './MonthlyTrendChart';
import TransactionCard from './TransactionCard';

interface Props {
  transactions: BudgetTransaction[];
  categories: BudgetCategory[];
  settings: BudgetSettings | null;
  currency: string;
  onSeeAll: () => void;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div
        className={[
          'mt-0.5 text-lg font-bold tabular-nums',
          tone === 'pos' ? 'text-green-600 dark:text-green-400' : tone === 'neg' ? 'text-red-600 dark:text-red-400' : '',
        ].join(' ')}
      >
        {value}
      </div>
    </div>
  );
}

export default function OverviewTab({ transactions, categories, settings, currency, onSeeAll }: Props) {
  const m = useBudgetMetrics(transactions, categories, settings);

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Income" value={formatMoney(m.totalIncome, currency)} tone="pos" />
        <Stat label="Expenses" value={formatMoney(m.totalExpenses, currency)} tone="neg" />
        <Stat label="Net" value={formatMoney(m.net, currency)} tone={m.net >= 0 ? 'pos' : 'neg'} />
        <Stat label="Saved" value={formatMoney(m.totalSavings, currency)} />
      </div>

      {/* Weekly limit / savings-goal pacing (only when a limit or goal is set) */}
      {(m.weekly.spendingLimit != null || m.weekly.savingsTarget != null) && (
        <WeeklyLimitsCard weekly={m.weekly} currency={currency} />
      )}

      {/* Alerts */}
      {m.alerts.length > 0 && (
        <div className="space-y-2">
          {m.alerts.map((a) => (
            <BudgetAlertCard key={a.categoryId} alert={a} currency={currency} />
          ))}
        </div>
      )}

      <SpendingChart data={m.spendingByCategory} currency={currency} />
      <WeeklyTrendChart data={m.weeklyTrend} currency={currency} />
      <MonthlyTrendChart data={m.monthlyTrend} currency={currency} />

      {/* Recent transactions */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recent</p>
          {m.recent.length > 0 && (
            <button
              type="button"
              onClick={onSeeAll}
              className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              See all
            </button>
          )}
        </div>
        {m.recent.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400 dark:border-gray-800">
            No transactions yet. Add one in the Transactions tab or say “I spent $12 on lunch”.
          </p>
        ) : (
          <div className="space-y-2">
            {m.recent.map((t) => (
              <TransactionCard
                key={t.id}
                tx={t}
                category={categories.find((c) => c.id === t.category_id) ?? null}
                currency={currency}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
