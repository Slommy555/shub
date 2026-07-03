import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { WeeklyPoint } from '../../hooks/budget/useBudgetMetrics';
import { formatMoney, formatMoneyShort } from '../../lib/budget';

/** Daily expense totals for the current week. */
export default function WeeklyTrendChart({
  data,
  currency,
}: {
  data: WeeklyPoint[];
  currency: string;
}) {
  const hasData = data.some((d) => d.amount > 0);
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">This week</p>
      {!hasData ? (
        <p className="py-8 text-center text-sm text-gray-400">No spending logged this week.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.2} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
            <YAxis
              tick={{ fontSize: 11, fill: '#9ca3af' }}
              width={48}
              tickFormatter={(v) => formatMoneyShort(Number(v), currency)}
            />
            <Tooltip
              cursor={{ fill: '#9ca3af1a' }}
              contentStyle={{ borderRadius: 12, border: '1px solid #6b728033', fontSize: 12 }}
              formatter={(v) => [formatMoney(Number(v), currency), 'Spent']}
            />
            <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
