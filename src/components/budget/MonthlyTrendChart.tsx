import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyPoint } from '../../hooks/budget/useBudgetMetrics';
import { formatMoney, formatMoneyShort } from '../../lib/budget';

type Series = 'income' | 'expenses' | 'net';

const SERIES: { id: Series; label: string; color: string }[] = [
  { id: 'income', label: 'Income', color: '#22c55e' },
  { id: 'expenses', label: 'Expenses', color: '#ef4444' },
  { id: 'net', label: 'Net', color: '#6366f1' },
];

/** Last 6 months, with a toggle for which series to plot. */
export default function MonthlyTrendChart({
  data,
  currency,
}: {
  data: MonthlyPoint[];
  currency: string;
}) {
  const [active, setActive] = useState<Series>('net');
  const series = SERIES.find((s) => s.id === active)!;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Last 6 months</p>
        <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          {SERIES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={[
                'rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors',
                active === s.id
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={48}
            tickFormatter={(v) => formatMoneyShort(Number(v), currency)}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #6b728033', fontSize: 12 }}
            formatter={(v) => [formatMoney(Number(v), currency), series.label]}
          />
          <Line
            type="monotone"
            dataKey={active}
            stroke={series.color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: series.color }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
