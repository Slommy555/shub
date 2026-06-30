import { useEffect, useMemo, useState } from 'react';
import { useBodyWeight } from '../../hooks/workout/useBodyWeight';
import {
  formatDate,
  mondayOf,
  parseISODate,
  round1,
  toISODate,
} from '../../lib/workout';
import type { BodyWeightLog, WeightView } from '../../types/workout';
import WeightChart from './WeightChart';

interface Props {
  userId: string;
}

const VIEWS: { id: WeightView; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly avg' },
  { id: 'monthly', label: 'Monthly avg' },
];

function groupAverage(
  ascending: BodyWeightLog[],
  keyOf: (iso: string) => string
): { date: string; weight: number }[] {
  const map = new Map<string, { sum: number; count: number }>();
  for (const e of ascending) {
    const k = keyOf(e.logged_at);
    const cur = map.get(k) ?? { sum: 0, count: 0 };
    cur.sum += e.weight_lbs;
    cur.count += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([date, { sum, count }]) => ({ date, weight: round1(sum / count) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export default function WeightTab({ userId }: Props) {
  const { entries, loading, addEntry, updateEntry, deleteEntry } = useBodyWeight(userId);

  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [view, setView] = useState<WeightView>('daily');

  const existing = useMemo(
    () => entries.find((e) => e.logged_at === date) ?? null,
    [entries, date]
  );

  // Keep the form in sync with the selected date's existing entry.
  useEffect(() => {
    setWeight(existing ? String(existing.weight_lbs) : '');
    setNotes(existing?.notes ?? '');
  }, [existing]);

  function submit() {
    const w = Number(weight);
    if (!Number.isFinite(w) || w <= 0) return;
    if (existing) updateEntry(existing.id, { weight_lbs: w, notes: notes.trim() || null });
    else addEntry({ weight_lbs: w, logged_at: date, notes: notes.trim() || null });
  }

  // --- chart data ----------------------------------------------------------
  const ascending = useMemo(() => [...entries].reverse(), [entries]);
  const chartData = useMemo(() => {
    if (view === 'daily') return ascending.map((e) => ({ date: e.logged_at, weight: e.weight_lbs }));
    if (view === 'weekly')
      return groupAverage(ascending, (iso) => toISODate(mondayOf(parseISODate(iso))));
    return groupAverage(ascending, (iso) => `${iso.slice(0, 7)}-01`);
  }, [ascending, view]);

  // --- stats ---------------------------------------------------------------
  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const current = entries[0];
    const weights = entries.map((e) => e.weight_lbs);
    const low = Math.min(...weights);
    const high = Math.max(...weights);

    const changeOver = (days: number): number | null => {
      const cutoff = toISODate(new Date(Date.now() - days * 86400000));
      // newest entry on or before the cutoff date
      const past = entries.find((e) => e.logged_at <= cutoff);
      return past ? round1(current.weight_lbs - past.weight_lbs) : null;
    };

    return {
      current: current.weight_lbs,
      d7: changeOver(7),
      d30: changeOver(30),
      low,
      high,
    };
  }, [entries]);

  return (
    <div className="mx-auto max-w-app space-y-5 p-4 pb-12">
      <h1 className="text-lg font-bold">Body weight</h1>

      {/* log entry */}
      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Date
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Weight (lbs)
            <input
              type="number"
              inputMode="decimal"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0"
              className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-gray-500">
            Notes
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional"
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
            />
          </label>
          <button
            type="button"
            onClick={submit}
            className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
          >
            {existing ? 'Update' : 'Log'}
          </button>
        </div>
      </div>

      {/* view toggle */}
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              view === v.id
                ? 'bg-gray-800 text-white'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-60 rounded-2xl" />
      ) : (
        <WeightChart data={chartData} />
      )}

      {/* stats strip */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          <StatBox label="Current" value={`${stats.current}`} />
          <StatBox label="7-day" value={fmtChange(stats.d7)} />
          <StatBox label="30-day" value={fmtChange(stats.d30)} />
          <StatBox label="All-time low" value={`${stats.low}`} />
          <StatBox label="All-time high" value={`${stats.high}`} />
        </div>
      )}

      {/* history */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">History</h2>
        {entries.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
            <p className="text-sm text-gray-400">No entries yet — log your weight above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-28 shrink-0 text-sm text-gray-500">{formatDate(e.logged_at)}</span>
                <span className="text-sm font-semibold">{e.weight_lbs} lbs</span>
                <span className="min-w-0 flex-1 truncate text-xs text-gray-400">{e.notes}</span>
                <button
                  type="button"
                  onClick={() => deleteEntry(e.id)}
                  aria-label="Delete entry"
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2 text-center dark:bg-gray-800/60">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function fmtChange(v: number | null): string {
  if (v === null) return '—';
  if (v > 0) return `+${v}`;
  return `${v}`;
}
