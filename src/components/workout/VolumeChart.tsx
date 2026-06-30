import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup, type VolumeRange } from '../../types/workout';
import { MUSCLE_PALETTE } from '../../lib/workout';
import type { VolumeSeries } from '../../hooks/workout/useMetrics';

interface Props {
  series: VolumeSeries;
  range: VolumeRange;
  onRange: (r: VolumeRange) => void;
}

const RANGES: { id: VolumeRange; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: '4weeks', label: 'Last 4 weeks' },
  { id: '3months', label: 'Last 3 months' },
];

function muscleColor(m: MuscleGroup): string {
  const i = MUSCLE_GROUPS.indexOf(m);
  return MUSCLE_PALETTE[i % MUSCLE_PALETTE.length];
}

export default function VolumeChart({ series, range, onRange }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = series.muscles.filter((m) => !hidden.has(m));

  function toggle(m: MuscleGroup) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Volume (lbs)</h2>
      </div>

      {/* range toggle */}
      <div className="mb-3 inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
        {RANGES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => onRange(r.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              range === r.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {series.muscles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-sm text-gray-400">No volume logged in this range yet.</p>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white p-2 dark:border-gray-800 dark:bg-gray-900">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={series.data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" strokeOpacity={0.2} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} width={48} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #6b728033',
                    fontSize: 12,
                  }}
                />
                {visible.map((m) => (
                  <Bar key={m} dataKey={m} stackId="v" name={MUSCLE_LABELS[m]} fill={muscleColor(m)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* toggleable legend */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {series.muscles.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-opacity ${
                  hidden.has(m)
                    ? 'border-gray-200 opacity-40 dark:border-gray-700'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: muscleColor(m) }} />
                {MUSCLE_LABELS[m]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
