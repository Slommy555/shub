import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACCENT, formatDate } from '../../lib/workout';

interface Props {
  data: { date: string; maxWeight: number }[];
}

/** Max weight per session over all time for one exercise. */
export default function ExerciseHistoryChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="text-sm text-gray-400">No history for this exercise yet.</p>
      </div>
    );
  }

  const chartData = data.map((d) => ({ ...d, label: formatDate(d.date) }));

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.2} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={48} domain={['dataMin - 10', 'dataMax + 10']} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #6b728033', fontSize: 12 }}
            formatter={(v) => [`${v} lbs`, 'Max weight']}
          />
          <Line
            type="monotone"
            dataKey="maxWeight"
            stroke={ACCENT}
            strokeWidth={2}
            dot={{ r: 3, fill: ACCENT }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
