import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type {
  Exercise,
  TemplateExercise,
  TemplateSet,
  TemplateWithExercises,
  WorkoutTemplate,
} from '../../types/workout';

/** A row the editor produces for a template's exercise list. */
export interface TemplateItemInput {
  exercise_id: string;
  position: number;
  default_sets: number | null;
  default_reps: number | null;
  default_weight: number | null;
  rest_seconds: number | null;
  sets: TemplateSet[];
}

/**
 * CRUD for workout templates. Takes the exercise library so it can hydrate each
 * template's exercises into full records for display.
 */
export function useTemplates(userId: string | null, exercises: Exercise[]) {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [templateExercises, setTemplateExercises] = useState<TemplateExercise[]>([]);
  const [lastUsed, setLastUsed] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  const exerciseById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const reload = useCallback(async () => {
    if (!userId) {
      setTemplates([]);
      setTemplateExercises([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: tpls, error } = await supabase
      .from('workout_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load templates:', error.message);
      setLoading(false);
      return;
    }
    const ids = (tpls ?? []).map((t) => t.id);
    let teRows: TemplateExercise[] = [];
    if (ids.length) {
      const { data: te } = await supabase
        .from('template_exercises')
        .select('*')
        .in('template_id', ids)
        .order('position', { ascending: true });
      teRows = (te ?? []) as TemplateExercise[];
    }
    // Last-used date per template (most recent session that referenced it).
    const { data: logRows } = await supabase
      .from('workout_logs')
      .select('template_id, started_at')
      .not('template_id', 'is', null)
      .order('started_at', { ascending: false });
    const lu: Record<string, string | null> = {};
    for (const l of logRows ?? []) {
      if (l.template_id && !(l.template_id in lu)) lu[l.template_id] = l.started_at;
    }
    setTemplates((tpls ?? []) as WorkoutTemplate[]);
    setTemplateExercises(teRows);
    setLastUsed(lu);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const hydrated: TemplateWithExercises[] = useMemo(
    () =>
      templates.map((t) => {
        const exs = templateExercises
          .filter((te) => te.template_id === t.id)
          .sort((a, b) => a.position - b.position)
          .map((te) => ({
            ...te,
            sets: Array.isArray(te.sets) ? te.sets : [],
            exercise: exerciseById.get(te.exercise_id),
          }))
          .filter((x): x is TemplateExercise & { exercise: Exercise } => Boolean(x.exercise));
        return {
          ...t,
          exercises: exs,
          exercise_count: exs.length,
          last_used_at: lastUsed[t.id] ?? null,
        };
      }),
    [templates, templateExercises, exerciseById, lastUsed]
  );

  const createTemplate = useCallback(
    async (name: string): Promise<WorkoutTemplate | null> => {
      if (!userId) return null;
      const id = crypto.randomUUID();
      const row: WorkoutTemplate = {
        id,
        user_id: userId,
        name: name.trim() || 'New Template',
        notes: null,
        created_at: new Date().toISOString(),
      };
      setTemplates((prev) => [row, ...prev]);
      const { error } = await supabase.from('workout_templates').insert({
        id,
        user_id: userId,
        name: row.name,
        notes: null,
      });
      if (error) {
        console.error('createTemplate failed:', error.message);
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        return null;
      }
      return row;
    },
    [userId]
  );

  const saveTemplate = useCallback(
    async (
      templateId: string,
      data: { name: string; notes: string | null; items: TemplateItemInput[] }
    ) => {
      // Optimistic local update.
      setTemplates((prev) =>
        prev.map((t) =>
          t.id === templateId ? { ...t, name: data.name, notes: data.notes } : t
        )
      );
      const newRows: TemplateExercise[] = data.items.map((it) => ({
        id: crypto.randomUUID(),
        template_id: templateId,
        exercise_id: it.exercise_id,
        position: it.position,
        default_sets: it.default_sets,
        default_reps: it.default_reps,
        default_weight: it.default_weight,
        rest_seconds: it.rest_seconds,
        sets: it.sets,
      }));
      setTemplateExercises((prev) => [
        ...prev.filter((te) => te.template_id !== templateId),
        ...newRows,
      ]);

      const { error: upErr } = await supabase
        .from('workout_templates')
        .update({ name: data.name, notes: data.notes })
        .eq('id', templateId);
      if (upErr) console.error('saveTemplate (template) failed:', upErr.message);

      // Replace the template_exercises rows wholesale.
      const { error: delErr } = await supabase
        .from('template_exercises')
        .delete()
        .eq('template_id', templateId);
      if (delErr) console.error('saveTemplate (clear) failed:', delErr.message);

      if (newRows.length) {
        const { error: insErr } = await supabase.from('template_exercises').insert(
          newRows.map((r) => ({
            id: r.id,
            template_id: r.template_id,
            exercise_id: r.exercise_id,
            position: r.position,
            default_sets: r.default_sets,
            default_reps: r.default_reps,
            default_weight: r.default_weight,
            rest_seconds: r.rest_seconds,
            sets: r.sets,
          }))
        );
        if (insErr) console.error('saveTemplate (insert) failed:', insErr.message);
      }
    },
    []
  );

  const deleteTemplate = useCallback(async (id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setTemplateExercises((prev) => prev.filter((te) => te.template_id !== id));
    const { error } = await supabase.from('workout_templates').delete().eq('id', id);
    if (error) console.error('deleteTemplate failed:', error.message);
  }, []);

  return {
    templates: hydrated,
    loading,
    reload,
    createTemplate,
    saveTemplate,
    deleteTemplate,
  };
}

export type UseTemplates = ReturnType<typeof useTemplates>;
