import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { cycleDayFor, resolveDay, todayForProgram, weekNumberFor } from '../../lib/program';
import type {
  ProgramDay,
  ProgramDayOverride,
  ProgramWeek,
  ResolvedProgramDay,
  WorkoutProgram,
} from '../../types/workout';

export interface NewProgramInput {
  name: string;
  start_date: string;
  total_weeks: number;
  cycle_length: number;
}

/** Where the user is standing in the active program right now. */
export interface ProgramToday {
  program: WorkoutProgram;
  weekNumber: number;
  dayNumber: number;
  day: ResolvedProgramDay;
  week: ProgramWeek | null;
  isDeload: boolean;
  /** Fraction of normal weight to work at today (1 outside a deload week). */
  volumePct: number;
}

/**
 * CRUD for training programs and their two child tables. Creating a program
 * seeds a full default split (one program_days row per cycle day) and one
 * program_weeks row per week, so every later edit is a plain update — no
 * "create the row if it's missing" branch anywhere in the UI.
 *
 * Only one program can be active at a time; activating one deactivates the rest.
 */
export function usePrograms(userId: string | null) {
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [days, setDays] = useState<ProgramDay[]>([]);
  const [weeks, setWeeks] = useState<ProgramWeek[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) {
      setPrograms([]);
      setDays([]);
      setWeeks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: progRows, error } = await supabase
      .from('workout_programs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Failed to load programs:', error.message);
      setLoading(false);
      return;
    }
    const ids = (progRows ?? []).map((p) => p.id);
    let dayRows: ProgramDay[] = [];
    let weekRows: ProgramWeek[] = [];
    if (ids.length) {
      const [{ data: d, error: dErr }, { data: w, error: wErr }] = await Promise.all([
        supabase.from('program_days').select('*').in('program_id', ids).order('day_number'),
        supabase.from('program_weeks').select('*').in('program_id', ids).order('week_number'),
      ]);
      if (dErr) console.error('Failed to load program days:', dErr.message);
      if (wErr) console.error('Failed to load program weeks:', wErr.message);
      dayRows = (d ?? []) as ProgramDay[];
      weekRows = (w ?? []) as ProgramWeek[];
    }
    setPrograms((progRows ?? []) as WorkoutProgram[]);
    setDays(dayRows);
    setWeeks(weekRows);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // --- reads ---------------------------------------------------------------

  const daysFor = useCallback(
    (programId: string) => days.filter((d) => d.program_id === programId),
    [days]
  );

  const weeksFor = useCallback(
    (programId: string) => weeks.filter((w) => w.program_id === programId),
    [weeks]
  );

  const weekFor = useCallback(
    (programId: string, weekNumber: number) =>
      weeks.find((w) => w.program_id === programId && w.week_number === weekNumber) ?? null,
    [weeks]
  );

  const activeProgram = useMemo(() => programs.find((p) => p.is_active) ?? null, [programs]);

  /**
   * Today's position in the active program: which week, which cycle day, what
   * that day resolves to, and whether it's a deload. null when there is no
   * active program or today falls outside its date range.
   */
  const today: ProgramToday | null = useMemo(() => {
    if (!activeProgram) return null;
    const iso = todayForProgram();
    const weekNumber = weekNumberFor(activeProgram, iso);
    if (weekNumber === null) return null;
    const dayNumber = cycleDayFor(activeProgram, iso);
    const week =
      weeks.find((w) => w.program_id === activeProgram.id && w.week_number === weekNumber) ?? null;
    const day = resolveDay(
      dayNumber,
      days.filter((d) => d.program_id === activeProgram.id),
      week
    );
    const isDeload = week?.is_deload === true;
    return {
      program: activeProgram,
      weekNumber,
      dayNumber,
      day,
      week,
      isDeload,
      volumePct: isDeload ? Number(week?.deload_volume_pct) || 0.6 : 1,
    };
  }, [activeProgram, days, weeks]);

  // --- mutations -----------------------------------------------------------

  const createProgram = useCallback(
    async (input: NewProgramInput): Promise<WorkoutProgram | null> => {
      if (!userId) return null;
      const cycle = input.cycle_length === 8 ? 8 : 7;
      const totalWeeks = Math.max(1, Math.min(104, Math.round(input.total_weeks) || 12));
      const { data, error } = await supabase
        .from('workout_programs')
        .insert({
          user_id: userId,
          name: input.name.trim() || 'Program',
          cycle_length: cycle,
          total_weeks: totalWeeks,
          start_date: input.start_date,
          is_active: false,
        })
        .select()
        .single();
      if (error || !data) {
        console.error('createProgram failed:', error?.message);
        return null;
      }
      const program = data as WorkoutProgram;

      // Seed the default split and every week up front.
      const dayRows = Array.from({ length: cycle }, (_, i) => ({
        program_id: program.id,
        day_number: i + 1,
        template_id: null,
        label: null,
        is_rest: false,
      }));
      const weekRows = Array.from({ length: totalWeeks }, (_, i) => ({
        program_id: program.id,
        week_number: i + 1,
        is_deload: false,
        deload_volume_pct: 0.6,
        notes: null,
        override_days: null,
      }));
      const [{ error: dErr }, { error: wErr }] = await Promise.all([
        supabase.from('program_days').insert(dayRows),
        supabase.from('program_weeks').insert(weekRows),
      ]);
      if (dErr) console.error('createProgram (days) failed:', dErr.message);
      if (wErr) console.error('createProgram (weeks) failed:', wErr.message);

      await reload();
      return program;
    },
    [userId, reload]
  );

  const deleteProgram = useCallback(async (id: string) => {
    setPrograms((prev) => prev.filter((p) => p.id !== id));
    setDays((prev) => prev.filter((d) => d.program_id !== id));
    setWeeks((prev) => prev.filter((w) => w.program_id !== id));
    const { error } = await supabase.from('workout_programs').delete().eq('id', id);
    if (error) console.error('deleteProgram failed:', error.message);
  }, []);

  /**
   * Edit a program's name, start date or length. Moving the start date shifts
   * the whole calendar — the weeks and the split both re-derive from it, so
   * nothing else needs rewriting. Changing `total_weeks` adds or removes
   * program_weeks rows so every week still has one; shrinking DROPS the deload
   * flags and notes on the weeks that go away.
   */
  const updateProgram = useCallback(
    async (
      id: string,
      patch: { name?: string; start_date?: string; total_weeks?: number }
    ) => {
      const existing = programs.find((p) => p.id === id);
      if (!existing) return;

      const next: { name?: string; start_date?: string; total_weeks?: number } = {};
      if (patch.name !== undefined) next.name = patch.name.trim() || 'Program';
      if (patch.start_date) next.start_date = patch.start_date;
      if (patch.total_weeks !== undefined) {
        next.total_weeks = Math.max(1, Math.min(104, Math.round(patch.total_weeks) || 1));
      }

      setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, ...next } : p)));
      const { error } = await supabase.from('workout_programs').update(next).eq('id', id);
      if (error) {
        console.error('updateProgram failed:', error.message);
        await reload();
        return;
      }

      const total = next.total_weeks;
      if (total !== undefined && total !== existing.total_weeks) {
        if (total > existing.total_weeks) {
          const added = Array.from({ length: total - existing.total_weeks }, (_, i) => ({
            program_id: id,
            week_number: existing.total_weeks + i + 1,
            is_deload: false,
            deload_volume_pct: 0.6,
            notes: null,
            override_days: null,
          }));
          const { error: addErr } = await supabase.from('program_weeks').insert(added);
          if (addErr) console.error('updateProgram (add weeks) failed:', addErr.message);
        } else {
          const { error: delErr } = await supabase
            .from('program_weeks')
            .delete()
            .eq('program_id', id)
            .gt('week_number', total);
          if (delErr) console.error('updateProgram (trim weeks) failed:', delErr.message);
        }
        await reload();
      }
    },
    [programs, reload]
  );

  /** Make one program active (or deactivate it), clearing the others. */
  const setActive = useCallback(
    async (id: string, active: boolean) => {
      if (!userId) return;
      setPrograms((prev) => prev.map((p) => ({ ...p, is_active: active && p.id === id })));
      if (active) {
        const { error: clearErr } = await supabase
          .from('workout_programs')
          .update({ is_active: false })
          .eq('user_id', userId)
          .neq('id', id);
        if (clearErr) console.error('setActive (clear) failed:', clearErr.message);
      }
      const { error } = await supabase
        .from('workout_programs')
        .update({ is_active: active })
        .eq('id', id);
      if (error) console.error('setActive failed:', error.message);
    },
    [userId]
  );

  /** Edit a day of the DEFAULT split — changes every week that has no override. */
  const setDefaultDay = useCallback(
    async (programId: string, dayNumber: number, patch: Partial<Omit<ProgramDay, 'id' | 'program_id' | 'day_number'>>) => {
      setDays((prev) =>
        prev.map((d) =>
          d.program_id === programId && d.day_number === dayNumber ? { ...d, ...patch } : d
        )
      );
      const { error } = await supabase
        .from('program_days')
        .update(patch)
        .eq('program_id', programId)
        .eq('day_number', dayNumber);
      if (error) console.error('setDefaultDay failed:', error.message);
    },
    []
  );

  const setWeekFields = useCallback(
    async (
      programId: string,
      weekNumber: number,
      patch: Partial<Omit<ProgramWeek, 'id' | 'program_id' | 'week_number'>>
    ) => {
      setWeeks((prev) =>
        prev.map((w) =>
          w.program_id === programId && w.week_number === weekNumber ? { ...w, ...patch } : w
        )
      );
      const { error } = await supabase
        .from('program_weeks')
        .update(patch)
        .eq('program_id', programId)
        .eq('week_number', weekNumber);
      if (error) console.error('setWeekFields failed:', error.message);
    },
    []
  );

  /** Edit one day of ONE week — writes an entry into that week's override_days. */
  const setWeekDayOverride = useCallback(
    async (
      programId: string,
      weekNumber: number,
      dayNumber: number,
      patch: ProgramDayOverride | null
    ) => {
      const current =
        weeks.find((w) => w.program_id === programId && w.week_number === weekNumber) ?? null;
      const next: Record<string, ProgramDayOverride> = { ...(current?.override_days ?? {}) };
      if (patch === null) delete next[String(dayNumber)];
      else next[String(dayNumber)] = patch;
      const value = Object.keys(next).length > 0 ? next : null;
      await setWeekFields(programId, weekNumber, { override_days: value });
    },
    [weeks, setWeekFields]
  );

  return {
    programs,
    loading,
    reload,
    activeProgram,
    today,
    daysFor,
    weeksFor,
    weekFor,
    createProgram,
    deleteProgram,
    updateProgram,
    setActive,
    setDefaultDay,
    setWeekFields,
    setWeekDayOverride,
  };
}

export type UsePrograms = ReturnType<typeof usePrograms>;
