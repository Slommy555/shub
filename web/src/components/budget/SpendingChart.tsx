import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { CategorySpend } from '../../hooks/budget/useBudgetMetrics';
import { formatMoney } from '../../lib/budget';

/** Donut chart of expense spending by category. */
export default function SpendingChart({
  data,
  currency,
}: {
  data: CategorySpend[];
  currency: string;
}) {
  const total = data.reduce((s, d) => s + d.amount, 0);

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="text-sm text-gray-400">No expenses this month yet.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Spending breakdown</p>
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={54}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
              >
                {data.map((d) => (
                  <Cell key={d.categoryId ?? 'none'} fill={d.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ borderRadius: 12, border: '1px solid #6b728033', fontSize: 12 }}
                formatter={(v, n) => [formatMoney(Number(v), currency), n]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-gray-400">Total</span>
            <span className="text-sm font-bold">{formatMoney(total, currency)}</span>
          </div>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 self-stretch">
          {data.slice(0, 8).map((d) => (
            <li key={d.categoryId ?? 'none'} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="min-w-0 flex-1 truncate text-gray-600 dark:text-gray-300">{d.name}</span>
              <span className="font-semibold tabular-nums">{formatMoney(d.amount, currency)}</span>
              <span className="w-10 text-right text-[11px] text-gray-400">
                {total > 0 ? Math.round((d.amount / total) * 100) : 0}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
