import { useEffect, useMemo, useState } from 'react';
import { useBodyWeight } from '../../hooks/workout/useBodyWeight';
import { round1 } from '../../lib/workout';
import { addDays, formatShort, todayISO } from '../../lib/dates';
import { haptic } from '../../lib/native';
import type { BodyWeightLog } from '../../types/workout';
import { Card, CardSkeleton, SectionHeader } from './parts';

/** Mean weight of the entries logged in [from, to], or null if there are none. */
function windowAvg(entries: BodyWeightLog[], from: string, to: string): number | null {
  let sum = 0;
  let n = 0;
  for (const e of entries) {
    if (e.logged_at < from || e.logged_at > to) continue;
    sum += Number(e.weight_lbs) || 0;
    n += 1;
  }
  return n > 0 ? sum / n : null;
}

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

  const stats = useMemo(() => {
    const thisWeek = windowAvg(entries, addDays(today, -6), today);
    const lastWeek = windowAvg(entries, addDays(today, -13), addDays(today, -7));
    return {
      avg: thisWeek,
      perWeek: thisWeek !== null && lastWeek !== null ? thisWeek - lastWeek : null,
      latest: entries[0] ?? null,
    };
  }, [entries, today]);

  function save() {
    const w = Number(draft);
    if (!Number.isFinite(w) || w <= 0) return;
    haptic();
    if (todayEntry) void updateEntry(todayEntry.id, { weight_lbs: w });
    else void addEntry({ weight_lbs: w, logged_at: today, notes: null });
  }

  if (loading) return <CardSkeleton rows={2} />;

  const { avg, perWeek, latest } = stats;
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
              {perWeek === null
                ? '—'
                : `${perWeek > 0 ? '↑' : perWeek < 0 ? '↓' : ''} ${round1(Math.abs(perWeek))} lb`}
            </span>
            <span className="mt-1.5 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              per week
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
