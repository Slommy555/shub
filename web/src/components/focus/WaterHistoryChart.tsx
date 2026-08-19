import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { weekdayShort } from '../../lib/dates';
import { formatOz } from '../../lib/water';

interface Props {
  /** Oldest → newest, one entry per day, zero-filled. */
  data: { date: string; oz: number }[];
  /** Daily target; drawn as a dashed reference line. */
  goal: number;
}

/**
 * Last 7 days of water intake. Bars that cleared the goal are green, the rest
 * take the accent — the dashed line is the goal, so the two together read as
 * "how often did I actually get there" at a glance.
 */
export default function WaterHistoryChart({ data, goal }: Props) {
  const chartData = data.map((d) => ({
    label: weekdayShort(d.date),
    date: d.date,
    oz: Math.round(d.oz * 10) / 10,
    met: goal > 0 && d.oz >= goal,
  }));

  const max = Math.max(goal, ...chartData.map((d) => d.oz));

  return (
    <div>
      <p
        className="mb-2 text-[13px] font-medium uppercase"
        style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
      >
        Last 7 days
      </p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-border-strong)"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
          />
          <YAxis
            width={40}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--color-text-tertiary)' }}
            domain={[0, Math.ceil((max || 1) * 1.15)]}
          />
          <Tooltip
            cursor={{ fill: 'var(--color-bg-surface)', opacity: 0.5 }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-bg-overlay)',
              fontSize: 12,
            }}
            labelStyle={{ color: 'var(--color-text-secondary)' }}
            formatter={(v) => [`${formatOz(Number(v))} oz`, 'Logged']}
          />
          {goal > 0 && (
            <ReferenceLine
              y={goal}
              stroke="var(--color-text-tertiary)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
            />
          )}
          <Bar dataKey="oz" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {chartData.map((d) => (
              <Cell
                key={d.date}
                fill={d.met ? 'var(--color-success)' : 'var(--color-accent)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
