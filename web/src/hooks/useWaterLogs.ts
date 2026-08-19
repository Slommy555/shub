import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDays, todayISO } from '../lib/dates';
import { dailyTotals, totalsByDate } from '../lib/water';
import type { WaterLog } from '../types/habits';

/** How much history the hook keeps loaded — enough for the 7-day chart. */
const HISTORY_DAYS = 7;

const byNewest = (a: WaterLog, b: WaterLog) =>
  a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;

/**
 * The water logs for one water habit over the last `HISTORY_DAYS` days, kept in
 * sync via realtime so the Home card and the Focus card move together.
 *
 * There's no reset: every row carries the calendar day it counts toward, so
 * "today's total" simply stops matching yesterday's rows at midnight and starts
 * again at 0 while the history stays intact.
 */
export function useWaterLogs(userId: string | null, habitId: string | null) {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [loading, setLoading] = useState(true);
  const today = todayISO();
  const since = addDays(today, -(HISTORY_DAYS - 1));

  const logsRef = useRef<WaterLog[]>([]);
  logsRef.current = logs;

  // --- initial load -------------------------------------------------------
  useEffect(() => {
    if (!userId || !habitId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('water_logs')
        .select('*')
        .eq('habit_id', habitId)
        .gte('logged_at', since)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('Failed to load water logs:', error.message);
      setLogs((data ?? []) as WaterLog[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, habitId, since]);

  // --- realtime -----------------------------------------------------------
  useEffect(() => {
    if (!userId || !habitId) return;
    const channel = supabase
      .channel(`water-rt-${habitId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'water_logs', filter: `habit_id=eq.${habitId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setLogs((prev) => prev.filter((l) => l.id !== id));
          } else {
            const row = payload.new as WaterLog;
            setLogs((prev) =>
              (prev.some((l) => l.id === row.id)
                ? prev.map((l) => (l.id === row.id ? row : l))
                : [...prev, row]
              ).sort(byNewest)
            );
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, habitId]);

  // --- derived ------------------------------------------------------------
  const totalByDate = useMemo(() => totalsByDate(logs), [logs]);

  const todayTotal = totalByDate.get(today) ?? 0;

  /** Today's most recent entry — what Undo removes. */
  const lastToday = useMemo(
    () => logs.filter((l) => l.logged_at === today).sort(byNewest)[0] ?? null,
    [logs, today]
  );

  /** Oldest → newest, one point per day, zero-filled. For the history chart. */
  const history = useMemo(() => dailyTotals(logs, today, HISTORY_DAYS), [logs, today]);

  // --- mutations ----------------------------------------------------------
  const addLog = useCallback(
    async (oz: number, label: string | null = null) => {
      if (!userId || !habitId) return;
      if (!Number.isFinite(oz) || oz <= 0) return;
      const id = crypto.randomUUID();
      const row: WaterLog = {
        id,
        user_id: userId,
        habit_id: habitId,
        logged_at: today,
        oz,
        label,
        created_at: new Date().toISOString(),
      };
      setLogs((prev) => [row, ...prev]);
      const { error } = await supabase.from('water_logs').insert({
        id,
        user_id: userId,
        habit_id: habitId,
        logged_at: today,
        oz,
        label,
      });
      if (error) {
        console.error('addLog failed:', error.message);
        setLogs((prev) => prev.filter((l) => l.id !== id));
      }
    },
    [userId, habitId, today]
  );

  /** Remove today's most recent entry. */
  const undoLast = useCallback(async () => {
    const target = logsRef.current.filter((l) => l.logged_at === today).sort(byNewest)[0];
    if (!target) return;
    setLogs((prev) => prev.filter((l) => l.id !== target.id));
    const { error } = await supabase.from('water_logs').delete().eq('id', target.id);
    if (error) {
      console.error('undoLast failed:', error.message);
      setLogs((prev) => [target, ...prev].sort(byNewest));
    }
  }, [today]);

  return { logs, loading, todayTotal, lastToday, history, addLog, undoLast };
}

export type UseWaterLogs = ReturnType<typeof useWaterLogs>;
