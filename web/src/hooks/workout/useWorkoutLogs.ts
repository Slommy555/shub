import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { WorkoutLog, WorkoutLogWithSets, WorkoutSet } from '../../types/workout';

/**
 * Fetches completed workout sessions with their sets hydrated. Pass a changing
 * `version` to force a refetch (e.g. after finishing a new workout).
 */
export function useWorkoutLogs(userId: string | null, version = 0) {
  const [logs, setLogs] = useState<WorkoutLogWithSets[]>([]);
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
      const { data: logRows, error } = await supabase
        .from('workout_logs')
        .select('*')
        .not('completed_at', 'is', null)
        .order('started_at', { ascending: false });
      if (error) {
        console.error('Failed to load workout logs:', error.message);
        if (!cancelled) setLoading(false);
        return;
      }
      const ids = (logRows ?? []).map((l) => l.id);
      let setRows: WorkoutSet[] = [];
      if (ids.length) {
        const { data: s, error: sErr } = await supabase
          .from('workout_sets')
          .select('*')
          .in('log_id', ids)
          .order('set_number', { ascending: true });
        if (sErr) console.error('Failed to load workout sets:', sErr.message);
        setRows = (s ?? []) as WorkoutSet[];
      }
      if (cancelled) return;
      const merged: WorkoutLogWithSets[] = (logRows ?? []).map((l) => ({
        ...(l as WorkoutLog),
        sets: setRows.filter((s) => s.log_id === l.id),
      }));
      setLogs(merged);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  const deleteLog = useCallback(async (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
    const { error } = await supabase.from('workout_logs').delete().eq('id', id);
    if (error) console.error('deleteLog failed:', error.message);
  }, []);

  return { logs, loading, deleteLog };
}

export type UseWorkoutLogs = ReturnType<typeof useWorkoutLogs>;
