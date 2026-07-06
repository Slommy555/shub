import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACCENT, formatDate, linearRegression, round1 } from '../../lib/workout';

interface Props {
  /** Ordered oldest → newest. */
  data: { date: string; weight: number }[];
}

export default function WeightChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="text-sm text-gray-400">No weight entries yet — log one above.</p>
      </div>
    );
  }

  const { slope, intercept } = linearRegression(data.map((d, i) => ({ x: i, y: d.weight })));
  const chartData = data.map((d, i) => ({
    label: formatDate(d.date),
    weight: d.weight,
    trend: round1(slope * i + intercept),
  }));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} minTickGap={24} />
          <YAxis
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            width={48}
            domain={['dataMin - 3', 'dataMax + 3']}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #6b728033', fontSize: 12 }}
            formatter={(v, name) => [`${v} lbs`, name === 'trend' ? 'Trend' : 'Weight']}
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="weight"
            stroke={ACCENT}
            strokeWidth={2}
            dot={{ r: 3, fill: ACCENT }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
