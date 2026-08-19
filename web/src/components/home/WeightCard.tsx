import { useEffect, useMemo, useState } from 'react';
import { useBodyWeight } from '../../hooks/workout/useBodyWeight';
import { round1 } from '../../lib/workout';
import { formatShort, todayISO } from '../../lib/dates';
import { formatWeightDelta, weightTrend } from '../../lib/weightTrend';
import { haptic } from '../../lib/native';
import { Card, CardSkeleton, SectionHeader } from './parts';

/**
 * Log today's weight and see the trend. Backed by `useBodyWeight` — the same
 * hook and the same `body_weight_logs` table as Workout → Weight, so an entry
 * made here is the same row that tab reads, and re-logging today updates it
 * rather than stacking a second entry on the same day.
 *
 * The headline is the 7-day moving average rather than the raw reading: daily
 * body weight swings on water and food, and the average is what actually trends.
 */
export default function WeightCard({ userId }: { userId: string }) {
  const { entries, loading, addEntry, updateEntry } = useBodyWeight(userId);
  const today = todayISO();
  const [draft, setDraft] = useState('');

  const todayEntry = useMemo(
    () => entries.find((e) => e.logged_at === today) ?? null,
    [entries, today]
  );

  // Show what's already logged for today so the field edits it in place.
  useEffect(() => {
    setDraft(todayEntry ? String(todayEntry.weight_lbs) : '');
  }, [todayEntry]);

  const trend = useMemo(() => weightTrend(entries, today), [entries, today]);
  const latest = entries[0] ?? null;

  function save() {
    const w = Number(draft);
    if (!Number.isFinite(w) || w <= 0) return;
    haptic();
    if (todayEntry) void updateEntry(todayEntry.id, { weight_lbs: w });
    else void addEntry({ weight_lbs: w, logged_at: today, notes: null });
  }

  if (loading) return <CardSkeleton rows={2} />;

  const avg = trend.recentAvg;
  // Postgres numerics can arrive as strings, so compare as numbers.
  const dirty = draft.trim() !== '' && Number(draft) !== Number(todayEntry?.weight_lbs ?? NaN);

  return (
    <Card>
      <SectionHeader
        title="Weight"
        meta={latest ? `last ${formatShort(latest.logged_at)}` : undefined}
      />

      {avg === null ? (
        <p className="text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
          No weight logged in the last 7 days
        </p>
      ) : (
        <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-col">
            <span
              className="text-[32px] font-bold leading-none tabular-nums"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
            >
              {round1(avg)}
              <span className="ml-1 text-[17px] font-medium" style={{ color: 'var(--color-text-tertiary)' }}>
                lb
              </span>
            </span>
            <span className="mt-1.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              7-day average
            </span>
          </div>

          {/* Direction only — up or down isn't inherently good or bad, that
              depends on whether you're cutting or bulking. */}
          <div className="flex min-w-0 flex-col">
            <span
              className="text-[20px] font-semibold leading-none tabular-nums"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
            >
              {trend.delta === null ? '—' : formatWeightDelta(trend)}
            </span>
            <span className="mt-1.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              {trend.delta === null ? 'Not enough data' : '7d avg'}
            </span>
          </div>
        </div>
      )}

      {/* Quick log — defaults to today, and edits today's entry if there is one. */}
      <div className="mt-auto flex gap-2 pt-4">
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
          placeholder="Today's weight"
          aria-label="Today's weight in pounds"
          className="min-w-0 flex-1 rounded-xl border px-4 text-[15px] tabular-nums outline-none"
          style={{
            height: 48,
            background: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />
        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className="shrink-0 rounded-xl px-5 text-[15px] font-semibold transition-opacity active:scale-[0.98] disabled:opacity-40"
          style={{
            height: 48,
            background: 'var(--color-accent)',
            color: 'var(--color-accent-text)',
          }}
        >
          {todayEntry ? 'Update' : 'Log'}
        </button>
      </div>
    </Card>
  );
}
