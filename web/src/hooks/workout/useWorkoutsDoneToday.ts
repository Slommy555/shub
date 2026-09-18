import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { todayISO } from '../../lib/dates';

/** How many times each template was logged today, keyed by template id. */
export interface DoneToday {
  counts: Map<string, number>;
  anyDone: boolean;
}

/**
 * The workouts completed today: how many times each template was logged, plus
 * whether anything at all was. The counts (not just a set of ids) are what lets
 * a day holding the same template twice tick off one session at a time.
 */
export async function fetchWorkoutsDoneToday(userId: string): Promise<DoneToday> {
  const start = `${todayISO()}T00:00:00`;
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id, template_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', new Date(start).toISOString());
  if (error) console.error('Failed to check today’s workouts:', error.message);
  const rows = data ?? [];
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (r.template_id) counts.set(r.template_id, (counts.get(r.template_id) ?? 0) + 1);
  }
  return { counts, anyDone: rows.length > 0 };
}

/** The same numbers as a hook, for the Home card. `reload` refetches. */
export function useWorkoutsDoneToday(userId: string): DoneToday & {
  loading: boolean;
  reload: () => void;
} {
  const [done, setDone] = useState<DoneToday>(() => ({ counts: new Map(), anyDone: false }));
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next = await fetchWorkoutsDoneToday(userId);
      if (cancelled) return;
      setDone(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  return { ...done, loading, reload };
}
