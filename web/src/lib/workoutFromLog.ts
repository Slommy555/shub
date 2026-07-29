import type {
  Exercise,
  SessionExercise,
  SessionSet,
  TemplateSet,
  WorkoutLogWithSets,
  WorkoutSet,
} from '../types/workout';

/** One exercise pulled back out of a completed session, with its sets in order. */
export interface LogExerciseGroup {
  exercise: Exercise;
  sets: WorkoutSet[];
  /** The per-exercise note (stored on the first saved set — see useWorkoutSession). */
  note: string;
}

/**
 * Regroup a completed log's flat set rows back into exercises. Exercise order
 * follows first appearance in the row list (which mirrors the order they were
 * saved in), and each exercise's sets are ordered by set number.
 */
export function groupLogSets(
  log: WorkoutLogWithSets,
  exercises: Exercise[]
): LogExerciseGroup[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const groups = new Map<string, LogExerciseGroup>();
  for (const s of log.sets) {
    const exercise = byId.get(s.exercise_id);
    if (!exercise) continue; // exercise was deleted from the library
    let g = groups.get(s.exercise_id);
    if (!g) {
      g = { exercise, sets: [], note: '' };
      groups.set(s.exercise_id, g);
    }
    g.sets.push(s);
  }
  for (const g of groups.values()) {
    g.sets.sort((a, b) => a.set_number - b.set_number);
    g.note = g.sets[0]?.notes?.trim() ?? '';
  }
  return Array.from(groups.values());
}

/** Total working volume (warm-ups excluded) and set count for a log. */
export function logTotals(log: WorkoutLogWithSets): { volume: number; sets: number } {
  let volume = 0;
  let sets = 0;
  for (const s of log.sets) {
    if (s.set_type === 'warmup') continue;
    volume += (s.weight_lbs ?? 0) * (s.reps ?? 0);
    sets += 1;
  }
  return { volume, sets };
}

/** Duration of a completed log in ms (0 when either timestamp is missing). */
export function logDurationMs(log: WorkoutLogWithSets): number {
  if (!log.started_at || !log.completed_at) return 0;
  return Math.max(0, new Date(log.completed_at).getTime() - new Date(log.started_at).getTime());
}

/**
 * Turn a completed session into template rows — the "make a template out of the
 * freestyle workout I just did" path. Weights/reps carry over as the plan.
 */
export function templateItemsFromLog(
  log: WorkoutLogWithSets,
  exercises: Exercise[]
): {
  exercise_id: string;
  position: number;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
  rest_seconds: number | null;
  sets: TemplateSet[];
}[] {
  return groupLogSets(log, exercises).map((g, i) => {
    const sets: TemplateSet[] = g.sets.map((s) => ({
      reps: s.reps,
      weight: s.weight_lbs,
      type: s.set_type,
      rest: null,
    }));
    const first = sets[0];
    return {
      exercise_id: g.exercise.id,
      position: i,
      default_sets: sets.length,
      default_reps: first?.reps ?? null,
      default_weight: first?.weight ?? null,
      rest_seconds: null,
      sets,
    };
  });
}

/**
 * Same idea as `templateItemsFromLog`, but from the in-memory session that was
 * just finished — so "Save as template" on the summary screen doesn't have to
 * wait for the log to round-trip through the database. Blank rows (no weight and
 * no reps) are dropped, matching what actually got saved.
 */
export function templateItemsFromSession(
  exercises: SessionExercise[]
): ReturnType<typeof templateItemsFromLog> {
  const out: ReturnType<typeof templateItemsFromLog> = [];
  for (const ex of exercises) {
    const sets: TemplateSet[] = ex.sets
      .filter((s) => s.weight_lbs != null || s.reps != null)
      .map((s) => ({ reps: s.reps, weight: s.weight_lbs, type: s.type, rest: s.rest ?? null }));
    if (sets.length === 0) continue;
    out.push({
      exercise_id: ex.exercise.id,
      position: out.length,
      default_sets: sets.length,
      default_reps: sets[0].reps,
      default_weight: sets[0].weight,
      rest_seconds: ex.restSeconds,
      sets,
    });
  }
  return out;
}

/** Turn a completed session into a fresh in-progress session (repeat a workout). */
export function sessionExercisesFromLog(
  log: WorkoutLogWithSets,
  exercises: Exercise[]
): SessionExercise[] {
  return groupLogSets(log, exercises).map((g) => {
    const sets: SessionSet[] = g.sets.map((s) => ({
      id: crypto.randomUUID(),
      weight_lbs: s.weight_lbs,
      reps: s.reps,
      rpe: null,
      notes: '',
      type: s.set_type,
      done: false,
      rest: null,
    }));
    return {
      key: crypto.randomUUID(),
      exercise: g.exercise,
      restSeconds: null,
      notes: g.note,
      sets: sets.length ? sets : [
        {
          id: crypto.randomUUID(),
          weight_lbs: null,
          reps: null,
          rpe: null,
          notes: '',
          type: 'normal',
          done: false,
          rest: null,
        },
      ],
    };
  });
}
