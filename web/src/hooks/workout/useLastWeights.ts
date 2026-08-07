import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

/** How many recent sets to scan when building the per-exercise last weight. */
const SCAN_LIMIT = 1500;

interface Row {
  exercise_id: string;
  weight_lbs: number | null;
  set_type: string | null;
  completed_at: string;
}

/**
 * The most recently logged WORKING weight for each exercise, keyed by
 * exercise_id. Used by the deload pre-fill (60% of last logged weight); warm-up
 * sets are ignored so a light warm-up never becomes the reference weight.
 *
 * RLS on workout_sets derives ownership from the parent log, so this only ever
 * returns the signed-in user's sets. Pass a changing `version` to refetch after
 * finishing a workout.
 */
export function useLastWeights(userId: string | null, version = 0) {
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setWeights({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('workout_sets')
        .select('exercise_id, weight_lbs, set_type, completed_at')
        .order('completed_at', { ascending: false })
        .limit(SCAN_LIMIT);
      if (cancelled) return;
      if (error) {
        console.error('Failed to load last weights:', error.message);
        setLoading(false);
        return;
      }
      // Rows arrive newest-first, so the first hit per exercise is the latest.
      const map: Record<string, number> = {};
      for (const row of (data ?? []) as Row[]) {
        if (row.set_type === 'warmup') continue;
        const w = Number(row.weight_lbs);
        if (!(w > 0)) continue;
        if (row.exercise_id in map) continue;
        map[row.exercise_id] = w;
      }
      setWeights(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  return { weights, loading };
}
