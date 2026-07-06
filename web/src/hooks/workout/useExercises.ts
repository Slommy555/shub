import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Exercise, MuscleGroup } from '../../types/workout';

/**
 * Loads the exercise library: the shared default catalog (user_id null) plus
 * the signed-in user's custom exercises. Exposes a creator for custom ones.
 */
export function useExercises(userId: string | null) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setExercises([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load exercises:', error.message);
        setLoading(false);
        return;
      }
      setExercises((data ?? []) as Exercise[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const createCustom = useCallback(
    async (name: string, muscleGroups: MuscleGroup[]): Promise<Exercise | null> => {
      if (!userId) return null;
      const id = crypto.randomUUID();
      const row: Exercise = {
        id,
        user_id: userId,
        name: name.trim(),
        muscle_groups: muscleGroups,
        is_custom: true,
        created_at: new Date().toISOString(),
      };
      // Optimistic insert, kept alphabetically sorted.
      setExercises((prev) =>
        [...prev, row].sort((a, b) => a.name.localeCompare(b.name))
      );
      const { error } = await supabase.from('exercises').insert({
        id,
        user_id: userId,
        name: row.name,
        muscle_groups: muscleGroups,
        is_custom: true,
      });
      if (error) {
        console.error('createCustom failed:', error.message);
        setExercises((prev) => prev.filter((e) => e.id !== id));
        return null;
      }
      return row;
    },
    [userId]
  );

  /** Deletes a custom exercise (RLS only permits the user's own rows). */
  const deleteExercise = useCallback(async (id: string) => {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('exercises').delete().eq('id', id);
    if (error) console.error('deleteExercise failed:', error.message);
  }, []);

  return { exercises, loading, createCustom, deleteExercise };
}

export type UseExercises = ReturnType<typeof useExercises>;
