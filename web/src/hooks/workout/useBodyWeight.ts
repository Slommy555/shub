import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { BodyWeightLog } from '../../types/workout';

/** Body-weight log CRUD with optimistic updates, newest first. */
export function useBodyWeight(userId: string | null) {
  const [entries, setEntries] = useState<BodyWeightLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('body_weight_logs')
        .select('*')
        .order('logged_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load body weight:', error.message);
        setLoading(false);
        return;
      }
      setEntries((data ?? []) as BodyWeightLog[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const byDateDesc = (a: BodyWeightLog, b: BodyWeightLog) =>
    a.logged_at < b.logged_at ? 1 : a.logged_at > b.logged_at ? -1 : 0;

  const addEntry = useCallback(
    async (input: { weight_lbs: number; logged_at: string; notes: string | null }) => {
      if (!userId) return;
      const id = crypto.randomUUID();
      const row: BodyWeightLog = { id, user_id: userId, ...input };
      setEntries((prev) => [row, ...prev].sort(byDateDesc));
      const { error } = await supabase.from('body_weight_logs').insert({
        id,
        user_id: userId,
        weight_lbs: input.weight_lbs,
        logged_at: input.logged_at,
        notes: input.notes,
      });
      if (error) {
        console.error('addEntry failed:', error.message);
        setEntries((prev) => prev.filter((e) => e.id !== id));
      }
    },
    [userId]
  );

  const updateEntry = useCallback(
    async (id: string, patch: Partial<Pick<BodyWeightLog, 'weight_lbs' | 'notes'>>) => {
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
      const { error } = await supabase.from('body_weight_logs').update(patch).eq('id', id);
      if (error) console.error('updateEntry failed:', error.message);
    },
    []
  );

  const deleteEntry = useCallback(async (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from('body_weight_logs').delete().eq('id', id);
    if (error) console.error('deleteEntry failed:', error.message);
  }, []);

  return { entries, loading, addEntry, updateEntry, deleteEntry };
}

export type UseBodyWeight = ReturnType<typeof useBodyWeight>;
