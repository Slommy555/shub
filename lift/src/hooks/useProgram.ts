import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, T, currentUserId } from '../lib/supabase'
import { emitChange, onChange } from '../lib/bus'
import { daysBetween, parseDate } from '../lib/format'
import type { Program, ProgramDay, WorkoutSession } from '../lib/types'

export type ProgramPosition =
  | { status: 'unscheduled' }
  | { status: 'upcoming'; startsIn: number }
  | { status: 'complete' }
  | { status: 'active'; week: number; dayNumber: number; isDeload: boolean }

export function programPosition(p: Program, today: Date = new Date()): ProgramPosition {
  if (!p.start_date) return { status: 'unscheduled' }
  const idx = daysBetween(parseDate(p.start_date), today)
  if (idx < 0) return { status: 'upcoming', startsIn: -idx }
  const week = Math.floor(idx / p.cycle_length) + 1
  if (week > p.total_weeks) return { status: 'complete' }
  return {
    status: 'active',
    week,
    dayNumber: (idx % p.cycle_length) + 1,
    isDeload: (p.deload_weeks ?? []).includes(week),
  }
}

export function useProgram() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [days, setDays] = useState<ProgramDay[]>([])
  const [todaySessions, setTodaySessions] = useState<WorkoutSession[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    const [p, d, s] = await Promise.all([
      supabase.from(T.programs).select('*').order('created_at', { ascending: false }),
      supabase.from(T.programDays).select('*').order('day_number').order('position'),
      supabase
        .from(T.sessions)
        .select('*')
        .gte('started_at', midnight.toISOString())
        .not('finished_at', 'is', null),
    ])
    if (!p.error && p.data) setPrograms(p.data as Program[])
    if (!d.error && d.data) setDays(d.data as ProgramDay[])
    if (!s.error && s.data) setTodaySessions(s.data as WorkoutSession[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const a = onChange('programs', load)
    const b = onChange('sessions', load)
    const c = onChange('templates', load)
    return () => {
      a()
      b()
      c()
    }
  }, [load])

  const active = useMemo(() => programs.find((p) => p.is_active) ?? null, [programs])
  const position = useMemo(() => (active ? programPosition(active) : null), [active])

  const daysFor = useCallback(
    (programId: string, dayNumber?: number) =>
      days.filter((d) => d.program_id === programId && (dayNumber == null || d.day_number === dayNumber)),
    [days],
  )

  /** Today's scheduled workout rows (non-rest, with a template) for the active program. */
  const todayWorkouts = useMemo(() => {
    if (!active || position?.status !== 'active') return []
    return daysFor(active.id, position.dayNumber).filter((d) => !d.is_rest && d.template_id)
  }, [active, position, daysFor])

  const loggedDayIds = useMemo(
    () => new Set(todaySessions.map((s) => s.program_day_id).filter(Boolean) as string[]),
    [todaySessions],
  )

  const pendingToday = useMemo(
    () => todayWorkouts.filter((d) => !loggedDayIds.has(d.id)),
    [todayWorkouts, loggedDayIds],
  )

  const create = useCallback(
    async (input: { name: string; start_date: string; total_weeks: number; cycle_length: number }) => {
      const user_id = await currentUserId()
      const hasActive = programs.some((p) => p.is_active)
      const { data, error } = await supabase
        .from(T.programs)
        .insert({ ...input, user_id, is_active: !hasActive })
        .select()
        .single()
      if (error) throw error
      emitChange('programs')
      return data as Program
    },
    [programs],
  )

  const setActive = useCallback(async (id: string) => {
    const user_id = await currentUserId()
    const off = await supabase.from(T.programs).update({ is_active: false }).eq('user_id', user_id).neq('id', id)
    if (off.error) throw off.error
    const on = await supabase.from(T.programs).update({ is_active: true }).eq('id', id)
    if (on.error) throw on.error
    emitChange('programs')
  }, [])

  const deactivate = useCallback(async (id: string) => {
    const { error } = await supabase.from(T.programs).update({ is_active: false }).eq('id', id)
    if (error) throw error
    emitChange('programs')
  }, [])

  const update = useCallback(async (id: string, patch: Partial<Program>) => {
    const { error } = await supabase.from(T.programs).update(patch).eq('id', id)
    if (error) throw error
    emitChange('programs')
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from(T.programs).delete().eq('id', id)
    if (error) throw error
    emitChange('programs')
  }, [])

  const toggleDeload = useCallback(
    async (program: Program, week: number) => {
      const set = new Set(program.deload_weeks ?? [])
      if (set.has(week)) set.delete(week)
      else set.add(week)
      await update(program.id, { deload_weeks: [...set].sort((a, b) => a - b) })
    },
    [update],
  )

  const addDay = useCallback(
    async (programId: string, dayNumber: number, templateId: string, label: string | null) => {
      const existing = days.filter((d) => d.program_id === programId && d.day_number === dayNumber)
      // Assigning a workout clears any rest marker for that day.
      const rest = existing.filter((d) => d.is_rest)
      if (rest.length) {
        await supabase.from(T.programDays).delete().in('id', rest.map((d) => d.id))
      }
      const { error } = await supabase.from(T.programDays).insert({
        program_id: programId,
        day_number: dayNumber,
        template_id: templateId,
        label,
        is_rest: false,
        position: existing.length,
      })
      if (error) throw error
      emitChange('programs')
    },
    [days],
  )

  const updateDay = useCallback(async (id: string, patch: Partial<ProgramDay>) => {
    const { error } = await supabase.from(T.programDays).update(patch).eq('id', id)
    if (error) throw error
    emitChange('programs')
  }, [])

  const removeDay = useCallback(async (id: string) => {
    const { error } = await supabase.from(T.programDays).delete().eq('id', id)
    if (error) throw error
    emitChange('programs')
  }, [])

  const setRest = useCallback(
    async (programId: string, dayNumber: number) => {
      const existing = days.filter((d) => d.program_id === programId && d.day_number === dayNumber)
      if (existing.length) {
        const del = await supabase.from(T.programDays).delete().in('id', existing.map((d) => d.id))
        if (del.error) throw del.error
      }
      const { error } = await supabase
        .from(T.programDays)
        .insert({ program_id: programId, day_number: dayNumber, is_rest: true, label: 'Rest', position: 0 })
      if (error) throw error
      emitChange('programs')
    },
    [days],
  )

  return {
    programs,
    days,
    active,
    position,
    todayWorkouts,
    pendingToday,
    loading,
    daysFor,
    create,
    setActive,
    deactivate,
    update,
    remove,
    toggleDeload,
    addDay,
    updateDay,
    removeDay,
    setRest,
  }
}
