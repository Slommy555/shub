import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ColorKey } from '../types';
import type { Habit, HabitKind, HabitLog } from '../types/habits';

const byPosition = (a: Habit, b: Habit) => a.position - b.position;

/**
 * Loads the signed-in user's habits + their completion logs, keeps both in
 * sync via Supabase realtime, and exposes optimistic CRUD plus a per-day
 * toggle. A log row existing for (habit, date) means it was done that day.
 */
export function useHabits(userId: string | null) {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const habitsRef = useRef<Habit[]>([]);
  habitsRef.current = habits;

  // --- initial load -------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setHabits([]);
      setLogs([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [{ data: habitRows, error: hErr }, { data: logRows, error: lErr }] = await Promise.all([
        supabase.from('habits').select('*').eq('archived', false).order('position', { ascending: true }),
        supabase.from('habit_logs').select('*'),
      ]);
      if (cancelled) return;
      if (hErr) console.error('Failed to load habits:', hErr.message);
      if (lErr) console.error('Failed to load habit logs:', lErr.message);
      setHabits(((habitRows ?? []) as Habit[]).sort(byPosition));
      setLogs((logRows ?? []) as HabitLog[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- realtime -----------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`habits-rt-${userId}`)
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

  // --- derived: completed dates per habit --------------------------------
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
    async (input: {
      name: string;
      kind: HabitKind;
      color: ColorKey;
      isWater?: boolean;
      waterGoalOz?: number | null;
    }) => {
      if (!userId) return;
      // A water habit owns the whole "water" concept — the presets, the goal,
      // the day's total — so a second one would just split the tally in two.
      if (input.isWater && habitsRef.current.some((h) => h.is_water_habit)) {
        setError(
          'You already have a water tracking habit. Edit the existing one to change your goal.'
        );
        return;
      }
      const id = crypto.randomUUID();
      // New habit goes on top; everyone else shifts down.
      const shifted = habitsRef.current.map((h) => ({ ...h, position: h.position + 1 }));
      const row: Habit = {
        id,
        user_id: userId,
        name: input.name,
        kind: input.kind,
        color: input.color,
        position: 0,
        archived: false,
        reminder_time: null,
        is_water_habit: input.isWater ?? false,
        water_goal_oz: input.isWater ? (input.waterGoalOz ?? null) : null,
        created_at: new Date().toISOString(),
      };
      setHabits([row, ...shifted].sort(byPosition));
      setError(null);
      const { error } = await supabase.from('habits').insert({
        id,
        user_id: userId,
        name: row.name,
        kind: row.kind,
        color: row.color,
        position: 0,
        is_water_habit: row.is_water_habit,
        water_goal_oz: row.water_goal_oz,
      });
      if (error) {
        console.error('addHabit failed:', error.message);
        // Roll the optimistic row back and surface why it didn't stick.
        setHabits((prev) => prev.filter((h) => h.id !== id));
        setError(
          /relation .*habits.* does not exist|could not find the table/i.test(error.message)
            ? 'The habits tables don’t exist yet. Run the 009_habits.sql migration in Supabase.'
            : // The one-water-habit-per-user unique index, if a second slipped
              // past the check above (e.g. created on another device).
              /habits_one_water_per_user/i.test(error.message)
              ? 'You already have a water tracking habit. Edit the existing one to change your goal.'
              : `Couldn’t save habit: ${error.message}`
        );
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
      patch: Partial<
        Pick<
          Habit,
          'name' | 'kind' | 'color' | 'position' | 'reminder_time' | 'is_water_habit' | 'water_goal_oz'
        >
      >
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

  /** Mark / unmark a habit for a given day. */
  const toggle = useCallback(
    async (habitId: string, date: string) => {
      if (!userId) return;
      const existing = logs.find((l) => l.habit_id === habitId && l.date === date);
      if (existing) {
        setLogs((prev) => prev.filter((l) => l.id !== existing.id));
        const { error } = await supabase.from('habit_logs').delete().eq('id', existing.id);
        if (error) console.error('toggle (remove) failed:', error.message);
      } else {
        const id = crypto.randomUUID();
        const row: HabitLog = { id, user_id: userId, habit_id: habitId, date };
        setLogs((prev) => [...prev, row]);
        const { error } = await supabase
          .from('habit_logs')
          .insert({ id, user_id: userId, habit_id: habitId, date });
        if (error) {
          console.error('toggle (add) failed:', error.message);
          setLogs((prev) => prev.filter((l) => l.id !== id));
        }
      }
    },
    [userId, logs]
  );

  /**
   * Force a habit's completion for a day to `done`, no-op if it's already
   * there. The water card drives this off the day's oz vs. the goal, so it
   * fires on every log and needs to be safe to call repeatedly — unlike
   * `toggle`, which flips whatever it finds.
   */
  const setDone = useCallback(
    async (habitId: string, date: string, done: boolean) => {
      if (!userId) return;
      const existing = logs.find((l) => l.habit_id === habitId && l.date === date);
      if (done === Boolean(existing)) return;
      await toggle(habitId, date);
    },
    [userId, logs, toggle]
  );

  return {
    habits,
    loading,
    error,
    doneByHabit,
    isDone,
    addHabit,
    updateHabit,
    deleteHabit,
    toggle,
    setDone,
  };
}

export type UseHabits = ReturnType<typeof useHabits>;
