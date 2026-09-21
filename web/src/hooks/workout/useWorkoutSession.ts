import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { diffTemplateEdits, templateItemsFromEdited } from '../../lib/templateEdits';
import type { TemplateItemInput } from './useTemplates';
import type {
  ActiveSession,
  Exercise,
  MuscleGroup,
  SessionExercise,
  SessionSet,
  SetType,
  TemplateBaselineExercise,
  TemplateWithExercises,
  WorkoutSummary,
} from '../../types/workout';

const STORAGE_KEY = 'activeWorkout';

function makeSet(prev?: SessionSet): SessionSet {
  return {
    id: crypto.randomUUID(),
    // Pre-fill from the previous set's values (spec: "Add set" copies prior row).
    weight_lbs: prev?.weight_lbs ?? null,
    reps: prev?.reps ?? null,
    rpe: prev?.rpe ?? null,
    notes: '',
    type: 'normal',
    done: false,
    rest: prev?.rest ?? null,
  };
}

/**
 * A superset needs at least two exercises. Removing one — by deleting it or by
 * unpairing it — can leave a group holding a single exercise, which would draw
 * a "SUPERSET" frame around one thing; clear those back to null.
 */
function dropLoneSupersets(exercises: SessionExercise[]): SessionExercise[] {
  const counts = new Map<string, number>();
  for (const e of exercises) {
    if (e.supersetGroupId) counts.set(e.supersetGroupId, (counts.get(e.supersetGroupId) ?? 0) + 1);
  }
  return exercises.map((e) =>
    e.supersetGroupId && (counts.get(e.supersetGroupId) ?? 0) < 2
      ? { ...e, supersetGroupId: null }
      : e
  );
}

/**
 * Pull each superset's members together, directly after the first of them. You
 * alternate between them set for set, so they belong side by side in the list —
 * and the grouped frame can only be drawn around a contiguous run.
 */
function orderSupersetsTogether(exercises: SessionExercise[]): SessionExercise[] {
  const out: SessionExercise[] = [];
  const placed = new Set<string>();
  for (const e of exercises) {
    if (placed.has(e.key)) continue;
    out.push(e);
    placed.add(e.key);
    if (!e.supersetGroupId) continue;
    for (const other of exercises) {
      if (placed.has(other.key) || other.supersetGroupId !== e.supersetGroupId) continue;
      out.push(other);
      placed.add(other.key);
    }
  }
  return out;
}

/**
 * Owns the in-progress workout. Persists to localStorage so a session survives
 * tab switches and reloads, and saves the log + sets to Supabase on finish.
 */
export function useWorkoutSession(userId: string | null) {
  const [session, setSession] = useState<ActiveSession | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as ActiveSession;
      // Backfill fields added after a session may have been persisted (e.g. the
      // per-exercise `notes`) so older in-progress sessions stay valid.
      parsed.exercises = (parsed.exercises ?? []).map((e) => ({
        ...e,
        notes: e.notes ?? '',
        supersetGroupId: e.supersetGroupId ?? null,
      }));
      return parsed;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore quota / serialization errors */
    }
  }, [session]);

  const startFreestyle = useCallback((name?: string) => {
    setSession({
      templateId: null,
      name: name?.trim() || 'Freestyle Workout',
      startedAt: new Date().toISOString(),
      exercises: [],
      templateBaseline: null,
    });
  }, []);

  /** Start a fresh session from already-built exercises (e.g. repeat a past log). */
  const startFromExercises = useCallback((name: string, exercises: SessionExercise[]) => {
    setSession({
      templateId: null,
      name: name.trim() || 'Workout',
      startedAt: new Date().toISOString(),
      exercises,
      templateBaseline: null,
    });
  }, []);

  /** Rename the in-progress session (freestyle sessions start unnamed-ish). */
  const rename = useCallback((name: string) => {
    setSession((s) => (s ? { ...s, name: name.trim() || s.name } : s));
  }, []);

  /**
   * Start a session from a template. `weightFor` (used by the deload pre-fill)
   * can override every set's starting weight per exercise; returning null keeps
   * the template's planned weight.
   */
  const startFromTemplate = useCallback((
    tpl: TemplateWithExercises,
    weightFor?: (exerciseId: string) => number | null
  ) => {
    // Snapshotted alongside the hydration so the two share the generated key —
    // that key is what pairs a template row with its live counterpart on finish.
    const baseline: TemplateBaselineExercise[] = [];
    const exercises: SessionExercise[] = tpl.exercises.map((te) => {
      const override = weightFor?.(te.exercise_id) ?? null;
      // Prefer the explicit per-set plan; fall back to legacy default_* counts.
      const planned =
        te.sets && te.sets.length > 0
          ? te.sets
          : Array.from({ length: Math.max(1, te.default_sets ?? 1) }, () => ({
              reps: te.default_reps ?? null,
              weight: te.default_weight ?? null,
              type: 'normal' as SetType,
              rest: null,
            }));
      const sets: SessionSet[] = planned.map((s) => ({
        id: crypto.randomUUID(),
        weight_lbs: override ?? s.weight ?? null,
        reps: s.reps ?? null,
        rpe: null,
        notes: '',
        type: s.type ?? 'normal',
        done: false,
        rest: s.rest ?? null,
      }));
      const key = crypto.randomUUID();
      baseline.push({
        key,
        exercise_id: te.exercise_id,
        name: te.exercise.name,
        reps: planned.map((s) => s.reps ?? null),
        // The PLANNED weight, never the deload override or anything logged.
        weights: planned.map((s) => s.weight ?? null),
        types: planned.map((s) => s.type ?? 'normal'),
        restPerSet: planned.map((s) => s.rest ?? null),
        rest_seconds: te.rest_seconds ?? null,
        superset_group_id: te.superset_group_id ?? null,
        prefillWeight: override,
      });
      return {
        key,
        exercise: te.exercise,
        restSeconds: te.rest_seconds ?? null,
        notes: '',
        supersetGroupId: te.superset_group_id ?? null,
        sets,
      };
    });
    setSession({
      templateId: tpl.id,
      name: tpl.name,
      startedAt: new Date().toISOString(),
      exercises,
      templateBaseline: { templateId: tpl.id, exercises: baseline },
    });
  }, []);

  const addExercise = useCallback((exercise: Exercise) => {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: [
              ...s.exercises,
              {
                key: crypto.randomUUID(),
                exercise,
                restSeconds: null,
                notes: '',
                supersetGroupId: null,
                sets: [makeSet()],
              },
            ],
          }
        : s
    );
  }, []);

  const removeExercise = useCallback((key: string) => {
    setSession((s) => {
      if (!s) return s;
      const kept = s.exercises.filter((e) => e.key !== key);
      return { ...s, exercises: dropLoneSupersets(kept) };
    });
  }, []);

  /**
   * Pair two exercises into a superset. Joining an exercise that's already in
   * one folds the other into that same group rather than starting a new id, so
   * "A with B, then B with C" ends up as one group of three, not two of two.
   */
  const pairSuperset = useCallback((keyA: string, keyB: string) => {
    setSession((s) => {
      if (!s || keyA === keyB) return s;
      const a = s.exercises.find((e) => e.key === keyA);
      const b = s.exercises.find((e) => e.key === keyB);
      if (!a || !b) return s;
      const groupId = a.supersetGroupId ?? b.supersetGroupId ?? crypto.randomUUID();
      // Everything already in either exercise's group joins the merged one.
      const absorbed = new Set(
        [a.supersetGroupId, b.supersetGroupId].filter((g): g is string => Boolean(g))
      );
      const exercises = s.exercises.map((e) =>
        e.key === keyA || e.key === keyB || (e.supersetGroupId && absorbed.has(e.supersetGroupId))
          ? { ...e, supersetGroupId: groupId }
          : e
      );
      return { ...s, exercises: orderSupersetsTogether(exercises) };
    });
  }, []);

  /** Drop one exercise out of its superset (and dissolve a group left at one). */
  const unpairSuperset = useCallback((key: string) => {
    setSession((s) => {
      if (!s) return s;
      const exercises = s.exercises.map((e) =>
        e.key === key ? { ...e, supersetGroupId: null } : e
      );
      return { ...s, exercises: dropLoneSupersets(exercises) };
    });
  }, []);

  const reorderExercises = useCallback((ordered: SessionExercise[]) => {
    // Re-tightened after the move so a superset travels as a unit: drag either
    // half and the other follows, rather than the pair splitting across the list.
    setSession((s) => (s ? { ...s, exercises: orderSupersetsTogether(ordered) } : s));
  }, []);

  const setExerciseRest = useCallback((key: string, restSeconds: number | null) => {
    setSession((s) =>
      s
        ? { ...s, exercises: s.exercises.map((e) => (e.key === key ? { ...e, restSeconds } : e)) }
        : s
    );
  }, []);

  const setExerciseNotes = useCallback((key: string, notes: string) => {
    setSession((s) =>
      s
        ? { ...s, exercises: s.exercises.map((e) => (e.key === key ? { ...e, notes } : e)) }
        : s
    );
  }, []);

  const addSet = useCallback((key: string) => {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e) =>
              e.key === key
                ? { ...e, sets: [...e.sets, makeSet(e.sets[e.sets.length - 1])] }
                : e
            ),
          }
        : s
    );
  }, []);

  const updateSet = useCallback(
    (key: string, setId: string, patch: Partial<SessionSet>) => {
      setSession((s) =>
        s
          ? {
              ...s,
              exercises: s.exercises.map((e) =>
                e.key === key
                  ? {
                      ...e,
                      sets: e.sets.map((st) =>
                        st.id === setId ? { ...st, ...patch } : st
                      ),
                    }
                  : e
              ),
            }
          : s
      );
    },
    []
  );

  const deleteSet = useCallback((key: string, setId: string) => {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: s.exercises.map((e) =>
              e.key === key
                ? { ...e, sets: e.sets.filter((st) => st.id !== setId) }
                : e
            ),
          }
        : s
    );
  }, []);

  const discard = useCallback(() => setSession(null), []);

  const finish = useCallback(
    async (notes: string, completedAtOverride?: string): Promise<WorkoutSummary | null> => {
      if (!userId || !session) return null;
      const logId = crypto.randomUUID();
      // The caller can pin the end time — the 2h30m auto-end stamps the session
      // at the cap so a workout left open overnight doesn't log as 14 hours.
      const completedAt = completedAtOverride ?? new Date().toISOString();

      const setRows: {
        id: string;
        log_id: string;
        exercise_id: string;
        set_number: number;
        weight_lbs: number | null;
        reps: number | null;
        rpe: number | null;
        notes: string | null;
        set_type: SetType;
        superset_group_id: string | null;
      }[] = [];
      const muscles = new Set<MuscleGroup>();
      const exsWithSets = new Set<string>();
      let totalVolume = 0;
      let totalSets = 0;

      for (const ex of session.exercises) {
        let n = 0;
        let working = 0;
        // No exercise-level notes table exists, so the per-exercise note is
        // stored on the first saved set's `notes` column (see SessionExercise).
        const exNote = (ex.notes ?? '').trim() || null;
        for (const st of ex.sets) {
          if (st.weight_lbs == null && st.reps == null) continue; // skip blank rows
          n += 1;
          setRows.push({
            id: st.id,
            log_id: logId,
            exercise_id: ex.exercise.id,
            set_number: n,
            weight_lbs: st.weight_lbs,
            reps: st.reps,
            rpe: st.rpe,
            notes: n === 1 ? exNote : null,
            set_type: st.type,
            superset_group_id: ex.supersetGroupId ?? null,
          });
          // Warm-up sets are recorded but excluded from volume/working totals.
          if (st.type !== 'warmup') {
            totalVolume += (st.weight_lbs ?? 0) * (st.reps ?? 0);
            totalSets += 1;
            working += 1;
          }
        }
        if (working > 0) {
          exsWithSets.add(ex.exercise.id);
          ex.exercise.muscle_groups.forEach((m) => muscles.add(m));
        }
      }

      const { error: logErr } = await supabase.from('workout_logs').insert({
        id: logId,
        user_id: userId,
        template_id: session.templateId,
        name: session.name,
        notes: notes.trim() || null,
        started_at: session.startedAt,
        completed_at: completedAt,
      });
      if (logErr) {
        console.error('finish (log) failed:', logErr.message);
        return null;
      }
      if (setRows.length) {
        const { error: setErr } = await supabase.from('workout_sets').insert(setRows);
        if (setErr) console.error('finish (sets) failed:', setErr.message);
      }

      const summary: WorkoutSummary = {
        totalVolume,
        totalSets,
        exerciseCount: exsWithSets.size,
        durationMs:
          new Date(completedAt).getTime() - new Date(session.startedAt).getTime(),
        muscleGroups: Array.from(muscles),
      };
      setSession(null);
      return summary;
    },
    [userId, session]
  );

  /**
   * What the user has changed about the template's STRUCTURE this session —
   * exercises added or removed, set counts, planned reps, order. Derived from
   * the baseline (which rides along in localStorage with the rest of the
   * session), so it survives a reload mid-workout.
   */
  const templateEdits = useMemo(
    () =>
      session?.templateBaseline
        ? diffTemplateEdits(session.templateBaseline, session.exercises)
        : [],
    [session]
  );
  const hasTemplateEdits = templateEdits.length > 0;

  /** The rows to write back, or null when this session came from no template. */
  const buildTemplateSave = useCallback((): {
    templateId: string;
    items: TemplateItemInput[];
  } | null => {
    const base = session?.templateBaseline;
    if (!session || !base) return null;
    // The template this session was STARTED from, matched by id — never by name
    // and never re-derived, so the edits land on exactly that template.
    const templateId = base.templateId || session.templateId;
    if (!templateId) return null;
    return {
      templateId,
      items: templateItemsFromEdited(base, session.exercises),
    };
  }, [session]);

  return {
    session,
    templateEdits,
    hasTemplateEdits,
    buildTemplateSave,
    startFreestyle,
    startFromTemplate,
    startFromExercises,
    rename,
    addExercise,
    removeExercise,
    reorderExercises,
    pairSuperset,
    unpairSuperset,
    setExerciseRest,
    setExerciseNotes,
    addSet,
    updateSet,
    deleteSet,
    discard,
    finish,
  };
}

export type UseWorkoutSession = ReturnType<typeof useWorkoutSession>;
