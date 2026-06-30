import { useCallback, useMemo } from 'react';
import {
  addDays,
  mondayOf,
  setVolume,
  startOfDay,
  thisWeekRange,
  toISODate,
} from '../../lib/workout';
import type {
  Exercise,
  ExercisePR,
  MuscleGroup,
  VolumeRange,
  WorkoutLogWithSets,
  WorkoutSet,
} from '../../types/workout';

interface DatedSet extends WorkoutSet {
  date: string; // ISO timestamp of the session
}

export interface VolumeSeries {
  data: Record<string, number | string>[];
  muscles: MuscleGroup[];
}

export interface ExerciseHistory {
  pr: ExercisePR | null;
  thisWeekSets: number;
  history: { date: string; maxWeight: number }[];
  sessions: {
    logId: string;
    date: string;
    name: string;
    sets: { weight: number | null; reps: number | null; rpe: number | null }[];
  }[];
}

/**
 * Pure derivation of all workout metrics from already-fetched logs + the
 * exercise library. No network — memoized so charts re-render cheaply.
 */
export function useMetrics(logs: WorkoutLogWithSets[], exercises: Exercise[]) {
  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const allSets: DatedSet[] = useMemo(
    () =>
      logs.flatMap((l) =>
        l.sets.map((s) => ({ ...s, date: l.started_at ?? l.created_at }))
      ),
    [logs]
  );

  // --- Muscle map: sets hit per muscle group this week (Mon–Sun) ----------
  const muscleSetsThisWeek = useMemo(() => {
    const { start, end } = thisWeekRange();
    const counts: Record<string, number> = {};
    for (const s of allSets) {
      if (s.set_type === 'warmup') continue; // warm-ups don't count as working sets
      const d = new Date(s.date);
      if (d < start || d >= end) continue;
      const ex = exerciseById.get(s.exercise_id);
      if (!ex) continue;
      for (const m of ex.muscle_groups) counts[m] = (counts[m] ?? 0) + 1;
    }
    return counts;
  }, [allSets, exerciseById]);

  // --- Volume chart: per-muscle volume bucketed by day or week ------------
  const volumeSeries = useCallback(
    (range: VolumeRange): VolumeSeries => {
      const now = new Date();
      type Bucket = { label: string; start: Date; end: Date };
      const buckets: Bucket[] = [];

      if (range === 'week') {
        const start = mondayOf(now);
        for (let i = 0; i < 7; i++) {
          const ds = addDays(start, i);
          buckets.push({
            label: ds.toLocaleDateString(undefined, { weekday: 'short' }),
            start: ds,
            end: addDays(ds, 1),
          });
        }
      } else {
        const weeks = range === '4weeks' ? 4 : 13;
        const start = mondayOf(now);
        for (let i = weeks - 1; i >= 0; i--) {
          const ws = addDays(start, -7 * i);
          buckets.push({
            label: ws.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
            start: ws,
            end: addDays(ws, 7),
          });
        }
      }

      const musclesPresent = new Set<MuscleGroup>();
      const rows = buckets.map((b) => {
        const row: Record<string, number | string> = { label: b.label };
        for (const s of allSets) {
          if (s.set_type === 'warmup') continue;
          const d = new Date(s.date);
          if (d < b.start || d >= b.end) continue;
          const ex = exerciseById.get(s.exercise_id);
          if (!ex) continue;
          const vol = setVolume(s);
          if (vol <= 0) continue;
          for (const m of ex.muscle_groups) {
            row[m] = ((row[m] as number) ?? 0) + vol;
            musclesPresent.add(m);
          }
        }
        return row;
      });

      return { data: rows, muscles: Array.from(musclesPresent) };
    },
    [allSets, exerciseById]
  );

  // --- Exercise history: PR, this-week sets, per-session chart + log ------
  const exerciseHistory = useCallback(
    (exerciseId: string): ExerciseHistory => {
      // Warm-ups excluded from PRs, history, and weekly counts.
      const mine = allSets.filter(
        (s) => s.exercise_id === exerciseId && s.set_type !== 'warmup'
      );
      const { start, end } = thisWeekRange();

      let pr: ExercisePR | null = null;
      let thisWeekSets = 0;
      // Group by session date (day) for the history chart.
      const bySession = new Map<string, DatedSet[]>();

      for (const s of mine) {
        const w = s.weight_lbs ?? 0;
        if (pr === null || w > pr.weight_lbs) {
          pr = { weight_lbs: w, reps: s.reps ?? 0, date: s.date };
        }
        const d = new Date(s.date);
        if (d >= start && d < end) thisWeekSets += 1;
        const key = toISODate(startOfDay(d));
        const arr = bySession.get(key) ?? [];
        arr.push(s);
        bySession.set(key, arr);
      }

      const logName = new Map(logs.map((l) => [l.id, l.name] as const));

      const history = Array.from(bySession.entries())
        .map(([day, sets]) => ({
          date: day,
          maxWeight: Math.max(...sets.map((s) => s.weight_lbs ?? 0)),
        }))
        .sort((a, b) => (a.date < b.date ? -1 : 1));

      const sessions = Array.from(bySession.entries())
        .map(([day, sets]) => ({
          logId: sets[0].log_id,
          date: day,
          name: logName.get(sets[0].log_id) ?? 'Workout',
          sets: sets.map((s) => ({ weight: s.weight_lbs, reps: s.reps, rpe: s.rpe })),
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1));

      return { pr: pr && pr.weight_lbs > 0 ? pr : null, thisWeekSets, history, sessions };
    },
    [allSets, logs]
  );

  return { muscleSetsThisWeek, volumeSeries, exerciseHistory };
}

export type UseMetrics = ReturnType<typeof useMetrics>;
