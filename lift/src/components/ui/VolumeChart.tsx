import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ExerciseSessionStat } from '../../hooks/useProgress'
import { fmtCompact, fmtNum, fmtWeight, shortDate } from '../../lib/format'

const GOLD = '#c8a050'
const GOLD_PR = '#e8c27a'

interface TipProps {
  active?: boolean
  payload?: { payload: ExerciseSessionStat }[]
}

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null
  const s = payload[0].payload
  return (
    <div className="rounded-input border border-line bg-elevated px-3 py-2 shadow-xl">
      <div className="font-mono text-[11px] text-ink-2">{shortDate(s.date)}</div>
      <div className="font-mono text-[14px] text-ink">{fmtNum(s.volume)} lb</div>
      <div className="font-mono text-[11px] text-ink-2">
        top {fmtWeight(s.topWeight)} × {s.topReps}
        {s.isPR && <span className="text-gold"> · PR</span>}
      </div>
    </div>
  )
}

export function VolumeChart({ data, compact }: { data: ExerciseSessionStat[]; compact?: boolean }) {
  return (
    <div style={{ height: compact ? 120 : 200 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: compact ? -28 : -12 }} barCategoryGap="28%">
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => shortDate(d)}
            tick={{ fill: '#888880', fontSize: 10, fontFamily: 'DM Mono' }}
            axisLine={{ stroke: '#1a1a1a' }}
            tickLine={false}
            interval={0}
          />
          <YAxis
            tickFormatter={(v: number) => fmtCompact(v)}
            tick={{ fill: '#888880', fontSize: 10, fontFamily: 'DM Mono' }}
            axisLine={false}
            tickLine={false}
            width={compact ? 56 : 48}
            tickCount={compact ? 3 : 4}
          />
          <Tooltip content={<Tip />} cursor={{ fill: 'rgba(200,160,80,0.06)' }} />
          <Bar dataKey="volume" radius={[4, 4, 0, 0]} maxBarSize={compact ? 22 : 30} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.sessionId} fill={d.isPR ? GOLD_PR : GOLD} fillOpacity={d.isPR ? 1 : 0.78} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
