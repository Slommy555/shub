import { useMemo, useState } from 'react';
import { useWorkoutLogs } from '../../hooks/workout/useWorkoutLogs';
import { useMetrics } from '../../hooks/workout/useMetrics';
import { formatDate } from '../../lib/workout';
import { type Exercise, type VolumeRange } from '../../types/workout';
import MuscleMap from './MuscleMap';
import VolumeChart from './VolumeChart';
import ExerciseHistoryChart from './ExerciseHistoryChart';

interface Props {
  userId: string;
  exercises: Exercise[];
  version: number;
}

export default function MetricsTab({ userId, exercises, version }: Props) {
  const { logs, loading } = useWorkoutLogs(userId, version);
  const metrics = useMetrics(logs, exercises);

  const [range, setRange] = useState<VolumeRange>('week');
  const [exId, setExId] = useState<string | null>(null);
  const [exQuery, setExQuery] = useState('');
  const [dropOpen, setDropOpen] = useState(false);

  const series = useMemo(() => metrics.volumeSeries(range), [metrics, range]);
  const hist = exId ? metrics.exerciseHistory(exId) : null;

  const filteredEx = useMemo(() => {
    const q = exQuery.trim().toLowerCase();
    return exercises.filter((e) => !q || e.name.toLowerCase().includes(q)).slice(0, 8);
  }, [exercises, exQuery]);

  if (loading) {
    return (
      <div className="mx-auto max-w-app space-y-4 p-4">
        <div className="skeleton h-72 rounded-2xl" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-app space-y-8 p-4 pb-12">
      {/* Section A */}
      <section>
        <MuscleMap counts={metrics.muscleSetsThisWeek} />
      </section>

      {/* Section B */}
      <section>
        <VolumeChart series={series} range={range} onRange={setRange} />
      </section>

      {/* Section C */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Exercise history</h2>

        <div className="relative">
          <input
            value={exQuery}
            onChange={(e) => {
              setExQuery(e.target.value);
              setDropOpen(true);
            }}
            onFocus={() => setDropOpen(true)}
            placeholder="Search an exercise…"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
          />
          {dropOpen && filteredEx.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900">
              {filteredEx.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => {
                    setExId(e.id);
                    setExQuery(e.name);
                    setDropOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {e.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {hist && (
          <div className="mt-3 space-y-3">
            {/* PR + this week */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">All-time PR</div>
                <div className="text-base font-semibold">
                  {hist.pr ? `${hist.pr.weight_lbs} lbs × ${hist.pr.reps}` : '—'}
                </div>
                {hist.pr && (
                  <div className="text-[11px] text-gray-500">{formatDate(hist.pr.date)}</div>
                )}
              </div>
              <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
                <div className="text-[11px] uppercase tracking-wide text-gray-400">This week</div>
                <div className="text-base font-semibold">{hist.thisWeekSets} sets</div>
              </div>
            </div>

            <ExerciseHistoryChart data={hist.history} />

            {/* all-time log */}
            {hist.sessions.length > 0 && (
              <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                <div className="border-b border-gray-100 px-3 py-2 text-xs font-semibold text-gray-500 dark:border-gray-800">
                  All-time log
                </div>
                <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800">
                  {hist.sessions.map((s, i) => (
                    <div key={`${s.logId}-${i}`} className="px-3 py-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{formatDate(s.date)}</span>
                        <span className="text-xs text-gray-400">{s.sets.length} sets</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {s.sets.map((st, j) => (
                          <span
                            key={j}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {st.weight ?? '—'}×{st.reps ?? '—'}
                            {st.rpe ? ` @${st.rpe}` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!hist && (
          <p className="mt-3 text-center text-sm text-gray-400">
            Pick an exercise to see PRs and history.
          </p>
        )}

        {logs.length === 0 && (
          <p className="mt-6 text-center text-sm text-gray-400">
            No workouts logged yet — finish a session to see your metrics fill in.
          </p>
        )}
      </section>
    </div>
  );
}
