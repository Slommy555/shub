import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACCENT, formatDate, round1 } from '../../lib/workout';
import { regressionByDate } from '../../lib/weightTrend';

interface Props {
  /** Ordered oldest → newest. */
  data: { date: string; weight: number }[];
  height?: number;
  /**
   * Drop the bordered card and the axes' breathing room, for embedding inside a
   * card that already supplies both — the Home weight widget.
   */
  bare?: boolean;
}

export default function WeightChart({ data, height = 240, bare = false }: Props) {
  if (data.length === 0) {
    return bare ? null : (
      <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
        <p className="text-sm text-gray-400">No weight entries yet — log one above.</p>
      </div>
    );
  }

  // Fit against the calendar, not against position in the array: a gap in
  // logging would otherwise count as one step like any other, so a skipped week
  // or a month with two entries would bend the slope for no reason.
  const { at } = regressionByDate(data);
  const chartData = data.map((d) => ({
    label: formatDate(d.date),
    weight: d.weight,
    trend: round1(at(d.date)),
  }));

  const wrapper = bare
    ? ''
    : 'rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900';

  return (
    <div className={wrapper}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#a1a1a1" strokeOpacity={0.2} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: '#a1a1a1' }}
            minTickGap={bare ? 40 : 24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#a1a1a1' }}
            width={bare ? 40 : 48}
            domain={['dataMin - 3', 'dataMax + 3']}
          />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: '1px solid #73737333', fontSize: 12 }}
            formatter={(v, name) => [`${v} lbs`, name === 'trend' ? 'Trend' : 'Weight']}
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke="#a1a1a1"
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
