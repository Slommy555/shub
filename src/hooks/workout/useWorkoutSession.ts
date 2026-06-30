import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  ActiveSession,
  Exercise,
  MuscleGroup,
  SessionExercise,
  SessionSet,
  SetType,
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
 * Owns the in-progress workout. Persists to localStorage so a session survives
 * tab switches and reloads, and saves the log + sets to Supabase on finish.
 */
export function useWorkoutSession(userId: string | null) {
  const [session, setSession] = useState<ActiveSession | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ActiveSession) : null;
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

  const startFreestyle = useCallback(() => {
    setSession({
      templateId: null,
      name: 'Freestyle Workout',
      startedAt: new Date().toISOString(),
      exercises: [],
    });
  }, []);

  const startFromTemplate = useCallback((tpl: TemplateWithExercises) => {
    const exercises: SessionExercise[] = tpl.exercises.map((te) => {
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
        weight_lbs: s.weight ?? null,
        reps: s.reps ?? null,
        rpe: null,
        notes: '',
        type: s.type ?? 'normal',
        done: false,
        rest: s.rest ?? null,
      }));
      return {
        key: crypto.randomUUID(),
        exercise: te.exercise,
        restSeconds: te.rest_seconds ?? null,
        sets,
      };
    });
    setSession({
      templateId: tpl.id,
      name: tpl.name,
      startedAt: new Date().toISOString(),
      exercises,
    });
  }, []);

  const addExercise = useCallback((exercise: Exercise) => {
    setSession((s) =>
      s
        ? {
            ...s,
            exercises: [
              ...s.exercises,
              { key: crypto.randomUUID(), exercise, restSeconds: null, sets: [makeSet()] },
            ],
          }
        : s
    );
  }, []);

  const removeExercise = useCallback((key: string) => {
    setSession((s) =>
      s ? { ...s, exercises: s.exercises.filter((e) => e.key !== key) } : s
    );
  }, []);

  const reorderExercises = useCallback((ordered: SessionExercise[]) => {
    setSession((s) => (s ? { ...s, exercises: ordered } : s));
  }, []);

  const setExerciseRest = useCallback((key: string, restSeconds: number | null) => {
    setSession((s) =>
      s
        ? { ...s, exercises: s.exercises.map((e) => (e.key === key ? { ...e, restSeconds } : e)) }
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
    async (notes: string): Promise<WorkoutSummary | null> => {
      if (!userId || !session) return null;
      const logId = crypto.randomUUID();
      const completedAt = new Date().toISOString();

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
      }[] = [];
      const muscles = new Set<MuscleGroup>();
      const exsWithSets = new Set<string>();
      let totalVolume = 0;
      let totalSets = 0;

      for (const ex of session.exercises) {
        let n = 0;
        let working = 0;
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
            notes: st.notes.trim() || null,
            set_type: st.type,
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

  return {
    session,
    startFreestyle,
    startFromTemplate,
    addExercise,
    removeExercise,
    reorderExercises,
    setExerciseRest,
    addSet,
    updateSet,
    deleteSet,
    discard,
    finish,
  };
}

export type UseWorkoutSession = ReturnType<typeof useWorkoutSession>;
