import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Macros, NutritionLog } from '../../types/nutrition';

/** Everything logged on one day, plus the running totals the strip renders. */
export function useNutritionLogs(userId: string | null, day: string) {
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('nutrition_logs')
        .select('*')
        .eq('user_id', userId)
        .eq('logged_at', day)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (error) console.error('load nutrition logs failed:', error.message);
      else setLogs((data as NutritionLog[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, day]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`nutrition_logs-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'nutrition_logs', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setLogs((prev) => prev.filter((l) => l.id !== id));
            return;
          }
          const row = payload.new as NutritionLog;
          setLogs((prev) => {
            // A row that moved to another day (or arrived for one) drops out here.
            if (row.logged_at !== day) return prev.filter((l) => l.id !== row.id);
            const exists = prev.some((l) => l.id === row.id);
            return exists ? prev.map((l) => (l.id === row.id ? row : l)) : [...prev, row];
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, day]);

  /** Insert optimistically so the total strip moves on the same frame as the tap. */
  const addLog = useCallback(
    async (entry: Macros & { food_name: string; serving_size: string | null }) => {
      if (!userId) return;
      const id = crypto.randomUUID();
      const row: NutritionLog = {
        id,
        user_id: userId,
        food_name: entry.food_name.trim() || 'Unknown Food',
        calories: entry.calories,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
        serving_size: entry.serving_size,
        logged_at: day,
        created_at: new Date().toISOString(),
      };
      setLogs((prev) => [...prev, row]);
      const { error } = await supabase.from('nutrition_logs').insert(row);
      if (error) {
        console.error('addLog failed:', error.message);
        setLogs((prev) => prev.filter((l) => l.id !== id));
      }
    },
    [userId, day]
  );

  /**
   * Insert several foods as separate rows in one round-trip — what "Add all to
   * my day" does with a described meal's breakdown. Optimistic like `addLog`,
   * and all-or-nothing: a failed insert rolls the whole batch back out of the
   * list rather than leaving a partial meal on screen.
   */
  const addLogs = useCallback(
    async (entries: (Macros & { food_name: string; serving_size: string | null })[]) => {
      if (!userId || entries.length === 0) return;
      const stamp = new Date().toISOString();
      const rows: NutritionLog[] = entries.map((entry) => ({
        id: crypto.randomUUID(),
        user_id: userId,
        food_name: entry.food_name.trim() || 'Unknown Food',
        calories: entry.calories,
        protein_g: entry.protein_g,
        carbs_g: entry.carbs_g,
        fat_g: entry.fat_g,
        serving_size: entry.serving_size,
        logged_at: day,
        created_at: stamp,
      }));
      setLogs((prev) => [...prev, ...rows]);
      const { error } = await supabase.from('nutrition_logs').insert(rows);
      if (error) {
        console.error('addLogs failed:', error.message);
        const ids = new Set(rows.map((r) => r.id));
        setLogs((prev) => prev.filter((l) => !ids.has(l.id)));
      }
    },
    [userId, day]
  );

  const updateLog = useCallback(
    async (id: string, patch: Partial<Omit<NutritionLog, 'id' | 'user_id'>>) => {
      setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
      const { error } = await supabase.from('nutrition_logs').update(patch).eq('id', id);
      if (error) console.error('updateLog failed:', error.message);
    },
    []
  );

  const deleteLog = useCallback(async (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from('nutrition_logs').delete().eq('id', id);
    if (error) console.error('deleteLog failed:', error.message);
  }, []);

  const totals = useMemo<Macros>(
    () =>
      logs.reduce(
        (acc, l) => ({
          calories: acc.calories + Number(l.calories || 0),
          protein_g: acc.protein_g + Number(l.protein_g || 0),
          carbs_g: acc.carbs_g + Number(l.carbs_g || 0),
          fat_g: acc.fat_g + Number(l.fat_g || 0),
        }),
        { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
      ),
    [logs]
  );

  return { logs, totals, loading, addLog, addLogs, updateLog, deleteLog };
}

export type UseNutritionLogs = ReturnType<typeof useNutritionLogs>;
