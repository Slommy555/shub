import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uuid } from '../lib/id';
import type { ColorKey, Habit, HabitKind, HabitLog } from '../lib/types';

const byPosition = (a: Habit, b: Habit) => a.position - b.position;

export interface NewHabitInput {
  name: string;
  kind?: HabitKind;
  color?: ColorKey;
  reminder_time?: string | null;
}

/**
 * Loads the user's habits + completion logs, keeps both synced via realtime,
 * and exposes optimistic CRUD plus a per-day toggle. A log row for (habit, date)
 * means the habit was done that day. Mirrors the web app's useHabits.
 */
export function useHabits(userId: string | null) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);

  const habitsRef = useRef<Habit[]>([]);
  habitsRef.current = habits;
  const logsRef = useRef<HabitLog[]>([]);
  logsRef.current = logs;
  // Unique per instance to avoid shared-channel collisions across screens.
  const channelIdRef = useRef(Math.random().toString(36).slice(2));

  const load = useCallback(async () => {
    if (!userId) {
      setHabits([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    const [{ data: habitRows, error: hErr }, { data: logRows, error: lErr }] = await Promise.all([
      supabase.from('habits').select('*').eq('archived', false).order('position', { ascending: true }),
      supabase.from('habit_logs').select('*'),
    ]);
    if (hErr) console.error('Failed to load habits:', hErr.message);
    if (lErr) console.error('Failed to load habit logs:', lErr.message);
    setHabits(((habitRows ?? []) as Habit[]).sort(byPosition));
    setLogs((logRows ?? []) as HabitLog[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // --- realtime -----------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`habits-rt-${userId}-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habits', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setHabits((prev) => prev.filter((h) => h.id !== id));
          } else {
            const row = payload.new as Habit;
            setHabits((prev) => {
              if (row.archived) return prev.filter((h) => h.id !== row.id);
              const exists = prev.some((h) => h.id === row.id);
              const next = exists ? prev.map((h) => (h.id === row.id ? row : h)) : [...prev, row];
              return next.sort(byPosition);
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'habit_logs', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setLogs((prev) => prev.filter((l) => l.id !== id));
          } else {
            const row = payload.new as HabitLog;
            setLogs((prev) => (prev.some((l) => l.id === row.id) ? prev : [...prev, row]));
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const doneByHabit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const l of logs) {
      let set = map.get(l.habit_id);
      if (!set) map.set(l.habit_id, (set = new Set()));
      set.add(l.date);
    }
    return map;
  }, [logs]);

  const isDone = useCallback(
    (habitId: string, date: string) => doneByHabit.get(habitId)?.has(date) ?? false,
    [doneByHabit]
  );

  // --- mutations ----------------------------------------------------------
  const addHabit = useCallback(
    async (input: NewHabitInput) => {
      if (!userId) return;
      const id = uuid();
      const shifted = habitsRef.current.map((h) => ({ ...h, position: h.position + 1 }));
      const row: Habit = {
        id,
        user_id: userId,
        name: input.name.trim(),
        kind: input.kind ?? 'habit',
        color: input.color ?? 'green',
        position: 0,
        archived: false,
        reminder_time: input.reminder_time ?? null,
        created_at: new Date().toISOString(),
      };
      setHabits([row, ...shifted].sort(byPosition));
      const { error } = await supabase.from('habits').insert({
        id,
        user_id: userId,
        name: row.name,
        kind: row.kind,
        color: row.color,
        position: 0,
        reminder_time: row.reminder_time,
      });
      if (error) {
        console.error('addHabit failed:', error.message);
        setHabits((prev) => prev.filter((h) => h.id !== id));
        return;
      }
      await Promise.all(
        shifted.map((h) => supabase.from('habits').update({ position: h.position }).eq('id', h.id))
      );
    },
    [userId]
  );

  const updateHabit = useCallback(
    async (
      id: string,
      patch: Partial<Pick<Habit, 'name' | 'kind' | 'color' | 'position' | 'reminder_time'>>
    ) => {
      setHabits((prev) => prev.map((h) => (h.id === id ? { ...h, ...patch } : h)).sort(byPosition));
      const { error } = await supabase.from('habits').update(patch).eq('id', id);
      if (error) console.error('updateHabit failed:', error.message);
    },
    []
  );

  const deleteHabit = useCallback(async (id: string) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setLogs((prev) => prev.filter((l) => l.habit_id !== id));
    const { error } = await supabase.from('habits').delete().eq('id', id);
    if (error) console.error('deleteHabit failed:', error.message);
  }, []);

  /** Mark / unmark a habit for a given day (default today). */
  const toggleCompletion = useCallback(
    async (habitId: string, date: string) => {
      if (!userId) return;
      const existing = logsRef.current.find((l) => l.habit_id === habitId && l.date === date);
      if (existing) {
        setLogs((prev) => prev.filter((l) => l.id !== existing.id));
        const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
        if (error) console.error('toggle (remove) failed:', error.message);
      } else {
        const id = uuid();
        setLogs((prev) => [...prev, { id, user_id: userId, habit_id: habitId, date }]);
        const { error } = await supabase
          .from('habit_logs')
          .insert({ id, user_id: userId, habit_id: habitId, date });
        if (error) {
          console.error('toggle (add) failed:', error.message);
          setLogs((prev) => prev.filter((l) => l.id !== id));
        }
      }
    },
    [userId]
  );

  return {
    habits,
    logs,
    loading,
    refetch: load,
    isDone,
    addHabit,
    updateHabit,
    deleteHabit,
    toggleCompletion,
  };
}

export type UseHabits = ReturnType<typeof useHabits>;
