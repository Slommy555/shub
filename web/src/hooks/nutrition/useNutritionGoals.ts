import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Macros, NutritionGoals } from '../../types/nutrition';

/**
 * The user's daily macro targets — one row per user, absent until they set
 * them. While absent the total strip shows plain numbers with no progress bars.
 */
export function useNutritionGoals(userId: string | null) {
  const [goals, setGoals] = useState<NutritionGoals | null>(null);

  useEffect(() => {
    if (!userId) {
      setGoals(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('nutrition_goals')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error('load nutrition goals failed:', error.message);
      else setGoals((data as NutritionGoals | null) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Upsert on user_id — the table's unique constraint keeps it to one row. */
  const saveGoals = useCallback(
    async (next: Macros) => {
      if (!userId) return;
      // Show the new targets immediately, then adopt the server row so `id`
      // reflects what actually got written rather than a placeholder.
      setGoals((prev) => ({ id: prev?.id ?? '', user_id: userId, ...next }));
      const { data, error } = await supabase
        .from('nutrition_goals')
        .upsert({ user_id: userId, ...next }, { onConflict: 'user_id' })
        .select()
        .maybeSingle();
      if (error) console.error('saveGoals failed:', error.message);
      else if (data) setGoals(data as NutritionGoals);
    },
    [userId]
  );

  return { goals, saveGoals };
}
