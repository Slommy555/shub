import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, T, currentUserId } from '../lib/supabase'
import { emitChange } from '../lib/bus'
import { fmtWeight, uid } from '../lib/format'
import type {
  Exercise,
  LiveExercise,
  LiveSession,
  LiveSet,
  SetFlag,
  TemplateExercise,
  TemplateSnapshot,
} from '../lib/types'

const STORAGE_KEY = 'lift-live-session'

export interface StartOptions {
  templateId: string | null
  programDayId?: string | null
  programId?: string | null
  name: string
  deload?: boolean
}

export interface TemplateChange {
  kind: 'added' | 'removed' | 'sets' | 'reps' | 'weight' | 'reorder'
  text: string
}

export interface PR {
  exerciseName: string
  weight: number
  reps: number
}

export interface FinishSummary {
  sessionId: string
  name: string
  durationSeconds: number
  volume: number
  exercisesCompleted: number
  setsCompleted: number
  prs: PR[]
  programDayId: string | null
}

/* ---------- pure helpers ---------- */

function liveVolume(s: LiveSet): number {
  if (!s.done || s.warmup) return 0
  const main = (s.weight ?? 0) * (s.reps ?? 0)
  const drop = s.drop ? (s.dropWeight ?? 0) * (s.dropReps ?? 0) : 0
  return main + drop
}

export function isExerciseComplete(ex: LiveExercise): boolean {
  return ex.sets.length > 0 && ex.sets.every((s) => s.done)
}

function newSet(weight: number | null, reps: number | null): LiveSet {
  return { id: uid(), warmup: false, failure: false, drop: false, weight, reps, dropWeight: null, dropReps: null, done: false }
}

function load(): LiveSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as LiveSession
    // Sessions saved before set flags stored a single `kind`.
    for (const ex of s.exercises) {
      ex.sets = ex.sets.map((st) => {
        const legacy = (st as LiveSet & { kind?: string }).kind
        if (legacy === undefined) return st
        return { ...st, warmup: legacy === 'warmup', failure: legacy === 'failure', drop: legacy === 'drop' }
      })
    }
    return s
  } catch {
    return null
  }
}

function save(s: LiveSession | null) {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage unavailable: session lives in memory only */
  }
}

/** Most recent finished session's top working set for each exercise. */
async function lastTopSets(exerciseIds: string[]): Promise<Map<string, { weight: number | null; reps: number | null }>> {
  const out = new Map<string, { weight: number | null; reps: number | null }>()
  if (!exerciseIds.length) return out
  const { data } = await supabase
    .from(T.sets)
    .select(`exercise_id, session_id, weight, reps, is_warmup, session:${T.sessions}!inner(started_at, finished_at)`)
    .in('exercise_id', exerciseIds)
    .not('session.finished_at', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(500)
  if (!data) return out
  type Row = { exercise_id: string; session_id: string; weight: number | null; reps: number | null; is_warmup: boolean }
  const latestSession = new Map<string, string>()
  for (const r of data as unknown as Row[]) {
    if (!latestSession.has(r.exercise_id)) latestSession.set(r.exercise_id, r.session_id)
    if (latestSession.get(r.exercise_id) !== r.session_id || r.is_warmup) continue
    const cur = out.get(r.exercise_id)
    if (!cur || (r.weight ?? 0) > (cur.weight ?? 0)) out.set(r.exercise_id, { weight: r.weight, reps: r.reps })
  }
  return out
}

function summarize(top: { weight: number | null; reps: number | null } | undefined): string | null {
  if (!top) return null
  if (top.weight == null || top.weight === 0) return top.reps != null ? `${top.reps} reps` : null
  return `${fmtWeight(top.weight)} lb × ${top.reps ?? 0}`
}

export function computeTemplateChanges(live: LiveSession): TemplateChange[] {
  if (!live.templateId) return []
  const changes: TemplateChange[] = []
  const snapIds = live.snapshot.map((s) => s.exerciseId)
  const liveIds = live.exercises.map((e) => e.exerciseId)

  for (const ex of live.exercises) {
    if (!snapIds.includes(ex.exerciseId)) changes.push({ kind: 'added', text: `Added ${ex.name}` })
  }
  for (const s of live.snapshot) {
    if (!liveIds.includes(s.exerciseId)) changes.push({ kind: 'removed', text: `Removed ${s.name}` })
  }
  for (const ex of live.exercises) {
    const snap = live.snapshot.find((s) => s.exerciseId === ex.exerciseId)
    if (!snap) continue
    const working = ex.sets.filter((s) => !s.warmup)
    if (working.length !== snap.sets) {
      changes.push({ kind: 'sets', text: `${ex.name}: ${snap.sets} → ${working.length} sets` })
    }
    const lastReps = [...working].reverse().find((s) => s.reps != null)?.reps ?? null
    if (lastReps != null && lastReps !== snap.reps) {
      changes.push({ kind: 'reps', text: `${ex.name}: ${snap.reps} → ${lastReps} reps` })
    }
    const weights = working.map((s) => s.weight).filter((w): w is number => w != null)
    const top = weights.length ? Math.max(...weights) : null
    if (top != null && top !== snap.weight) {
      changes.push({
        kind: 'weight',
        text: `${ex.name}: ${snap.weight == null ? '—' : fmtWeight(snap.weight)} → ${fmtWeight(top)} lb`,
      })
    }
  }
  const shared = snapIds.filter((id) => liveIds.includes(id))
  const liveShared = liveIds.filter((id) => snapIds.includes(id))
  if (shared.join() !== liveShared.join()) changes.push({ kind: 'reorder', text: 'Exercise order changed' })
  return changes
}

/* ---------- context ---------- */

function useWorkoutSessionState() {
  const [live, setLive] = useState<LiveSession | null>(() => load())
  const [starting, setStarting] = useState(false)

  useEffect(() => save(live), [live])

  const mutate = useCallback((fn: (s: LiveSession) => LiveSession) => {
    setLive((prev) => (prev ? fn(prev) : prev))
  }, [])

  const mutateExercise = useCallback(
    (key: string, fn: (ex: LiveExercise) => LiveExercise) =>
      mutate((s) => ({ ...s, exercises: s.exercises.map((e) => (e.key === key ? fn(e) : e)) })),
    [mutate],
  )

  const start = useCallback(async (opts: StartOptions) => {
    setStarting(true)
    try {
      const user_id = await currentUserId()
      let rows: (TemplateExercise & { exercise: Pick<Exercise, 'name'> })[] = []
      if (opts.templateId) {
        const { data, error } = await supabase
          .from(T.templateExercises)
          .select(`*, exercise:${T.exercises}(name)`)
          .eq('template_id', opts.templateId)
          .order('position')
        if (error) throw error
        rows = (data ?? []) as typeof rows
      }
      const { data: session, error } = await supabase
        .from(T.sessions)
        .insert({
          user_id,
          template_id: opts.templateId,
          program_day_id: opts.programDayId ?? null,
          name: opts.name,
        })
        .select()
        .single()
      if (error) throw error

      const last = await lastTopSets(rows.map((r) => r.exercise_id))
      const exercises: LiveExercise[] = rows.map((r) => {
        const count = opts.deload ? Math.max(1, Math.round(r.default_sets * 0.6)) : r.default_sets
        const weight = r.default_weight ?? last.get(r.exercise_id)?.weight ?? null
        return {
          key: uid(),
          exerciseId: r.exercise_id,
          name: r.exercise?.name ?? 'Exercise',
          supersetGroupId: r.superset_group_id,
          restSeconds: r.rest_seconds,
          sets: Array.from({ length: Math.max(1, count) }, () => newSet(weight, r.default_reps)),
          lastSummary: summarize(last.get(r.exercise_id)),
          completedAt: null,
        }
      })
      const snapshot: TemplateSnapshot[] = rows.map((r) => ({
        exerciseId: r.exercise_id,
        name: r.exercise?.name ?? 'Exercise',
        sets: r.default_sets,
        reps: r.default_reps,
        weight: r.default_weight,
      }))
      setLive({
        sessionId: session.id,
        templateId: opts.templateId,
        programDayId: opts.programDayId ?? null,
        programId: opts.programId ?? null,
        name: opts.name,
        startedAt: Date.now(),
        exercises,
        snapshot,
        restEndsAt: null,
        restTotal: 0,
      })
    } finally {
      setStarting(false)
    }
  }, [])

  const updateSet = useCallback(
    (exKey: string, setId: string, patch: Partial<LiveSet>) =>
      mutateExercise(exKey, (ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
      })),
    [mutateExercise],
  )

  const toggleSet = useCallback(
    (exKey: string, setId: string) =>
      mutate((s) => {
        let restFor: number | null = null
        const exercises = s.exercises.map((ex) => {
          if (ex.key !== exKey) return ex
          const sets = ex.sets.map((st) => (st.id === setId ? { ...st, done: !st.done } : st))
          const ticked = sets.find((st) => st.id === setId)?.done
          if (ticked) {
            // In a superset, rest only after the last exercise of the round.
            const group = ex.supersetGroupId
              ? s.exercises.filter((e) => e.supersetGroupId === ex.supersetGroupId)
              : [ex]
            if (group[group.length - 1].key === ex.key) restFor = ex.restSeconds
          }
          const next = { ...ex, sets }
          return {
            ...next,
            completedAt: isExerciseComplete(next) ? (ex.completedAt ?? Date.now()) : null,
          }
        })
        const now = Date.now()
        return restFor
          ? { ...s, exercises, restEndsAt: now + restFor * 1000, restTotal: restFor }
          : { ...s, exercises }
      }),
    [mutate],
  )

  const toggleFlag = useCallback(
    (exKey: string, setId: string, flag: SetFlag) =>
      mutateExercise(exKey, (ex) => ({
        ...ex,
        sets: ex.sets.map((s) => {
          if (s.id !== setId) return s
          const on = !s[flag]
          const dropOn = flag === 'drop' ? on : s.drop
          return {
            ...s,
            [flag]: on,
            dropWeight: dropOn ? (s.dropWeight ?? (s.weight != null ? Math.round(s.weight * 0.75) : null)) : s.dropWeight,
            dropReps: dropOn ? (s.dropReps ?? s.reps) : s.dropReps,
          }
        }),
      })),
    [mutateExercise],
  )

  const addSet = useCallback(
    (exKey: string) =>
      mutateExercise(exKey, (ex) => {
        const prev = [...ex.sets].reverse().find((s) => !s.warmup) ?? ex.sets[ex.sets.length - 1]
        return { ...ex, completedAt: null, sets: [...ex.sets, newSet(prev?.weight ?? null, prev?.reps ?? null)] }
      }),
    [mutateExercise],
  )

  const removeSet = useCallback(
    (exKey: string, setId: string) =>
      mutateExercise(exKey, (ex) => {
        const sets = ex.sets.filter((s) => s.id !== setId)
        const next = { ...ex, sets }
        return { ...next, completedAt: isExerciseComplete(next) ? (ex.completedAt ?? Date.now()) : null }
      }),
    [mutateExercise],
  )

  const addExercise = useCallback(
    async (exercise: Exercise) => {
      const last = await lastTopSets([exercise.id])
      const top = last.get(exercise.id)
      const ex: LiveExercise = {
        key: uid(),
        exerciseId: exercise.id,
        name: exercise.name,
        supersetGroupId: null,
        restSeconds: 90,
        sets: [newSet(top?.weight ?? null, top?.reps ?? 10), newSet(top?.weight ?? null, top?.reps ?? 10), newSet(top?.weight ?? null, top?.reps ?? 10)],
        lastSummary: summarize(top),
        completedAt: null,
      }
      mutate((s) => ({ ...s, exercises: [...s.exercises, ex] }))
    },
    [mutate],
  )

  const removeExercise = useCallback(
    (key: string) =>
      mutate((s) => {
        const target = s.exercises.find((e) => e.key === key)
        let exercises = s.exercises.filter((e) => e.key !== key)
        // A superset of one is just an exercise.
        if (target?.supersetGroupId) {
          const rest = exercises.filter((e) => e.supersetGroupId === target.supersetGroupId)
          if (rest.length === 1) exercises = exercises.map((e) => (e.key === rest[0].key ? { ...e, supersetGroupId: null } : e))
        }
        return { ...s, exercises }
      }),
    [mutate],
  )

  const moveExercise = useCallback(
    (key: string, dir: -1 | 1) =>
      mutate((s) => {
        const i = s.exercises.findIndex((e) => e.key === key)
        const j = i + dir
        if (i < 0 || j < 0 || j >= s.exercises.length) return s
        const exercises = [...s.exercises]
        ;[exercises[i], exercises[j]] = [exercises[j], exercises[i]]
        return { ...s, exercises }
      }),
    [mutate],
  )

  const supersetWithNext = useCallback(
    (key: string) =>
      mutate((s) => {
        const i = s.exercises.findIndex((e) => e.key === key)
        // Skip past the rest of this exercise's own group.
        const cur = s.exercises[i]
        let j = i + 1
        while (j < s.exercises.length && cur.supersetGroupId && s.exercises[j].supersetGroupId === cur.supersetGroupId) j++
        if (i < 0 || j >= s.exercises.length) return s
        const groupId = cur.supersetGroupId ?? s.exercises[j].supersetGroupId ?? uid()
        const oldNext = s.exercises[j].supersetGroupId
        return {
          ...s,
          exercises: s.exercises.map((e, idx) =>
            idx === i || idx === j || (oldNext && e.supersetGroupId === oldNext) || (cur.supersetGroupId && e.supersetGroupId === cur.supersetGroupId)
              ? { ...e, supersetGroupId: groupId }
              : e,
          ),
        }
      }),
    [mutate],
  )

  const unlinkSuperset = useCallback(
    (key: string) =>
      mutate((s) => {
        const groupId = s.exercises.find((e) => e.key === key)?.supersetGroupId
        if (!groupId) return s
        return {
          ...s,
          exercises: s.exercises.map((e) => (e.supersetGroupId === groupId ? { ...e, supersetGroupId: null } : e)),
        }
      }),
    [mutate],
  )

  const setRest = useCallback(
    (key: string, seconds: number) => mutateExercise(key, (ex) => ({ ...ex, restSeconds: seconds })),
    [mutateExercise],
  )

  const dismissRest = useCallback(() => mutate((s) => ({ ...s, restEndsAt: null })), [mutate])
  const adjustRest = useCallback(
    (delta: number) =>
      mutate((s) =>
        s.restEndsAt ? { ...s, restEndsAt: Math.max(Date.now(), s.restEndsAt + delta * 1000), restTotal: Math.max(1, s.restTotal + delta) } : s,
      ),
    [mutate],
  )

  const abandon = useCallback(async () => {
    if (!live) return
    await supabase.from(T.sessions).delete().eq('id', live.sessionId)
    setLive(null)
  }, [live])

  /** Persist completed sets, close the session, and return the summary. */
  const finish = useCallback(async (): Promise<FinishSummary> => {
    if (!live) throw new Error('No active session')
    const durationSeconds = Math.round((Date.now() - live.startedAt) / 1000)

    // History for PR detection, read before this session's sets are written.
    const ids = [...new Set(live.exercises.map((e) => e.exerciseId))]
    const history = new Map<string, { weight: number; reps: number }[]>()
    if (ids.length) {
      const { data } = await supabase
        .from(T.sets)
        .select(`exercise_id, weight, reps, is_warmup, session:${T.sessions}!inner(finished_at)`)
        .in('exercise_id', ids)
        .neq('session_id', live.sessionId)
        .not('session.finished_at', 'is', null)
        .limit(5000)
      for (const r of (data ?? []) as unknown as { exercise_id: string; weight: number | null; reps: number | null; is_warmup: boolean }[]) {
        if (r.is_warmup) continue
        const list = history.get(r.exercise_id) ?? []
        list.push({ weight: r.weight ?? 0, reps: r.reps ?? 0 })
        history.set(r.exercise_id, list)
      }
    }

    const rows = live.exercises.flatMap((ex) =>
      ex.sets
        .filter((s) => s.done)
        .map((s, i) => ({
          session_id: live.sessionId,
          exercise_id: ex.exerciseId,
          set_number: i + 1,
          weight: s.weight,
          reps: s.reps,
          is_warmup: s.warmup,
          is_failure: s.failure,
          is_dropset: s.drop,
          drop_weight: s.drop ? s.dropWeight : null,
          drop_reps: s.drop ? s.dropReps : null,
          superset_group_id: ex.supersetGroupId,
        })),
    )
    if (rows.length) {
      const { error } = await supabase.from(T.sets).insert(rows)
      if (error) throw error
    }
    const { error } = await supabase
      .from(T.sessions)
      .update({ finished_at: new Date().toISOString(), duration_seconds: durationSeconds })
      .eq('id', live.sessionId)
    if (error) throw error

    // PR: beats the best previous weight at the same or more reps.
    const prs: PR[] = []
    for (const ex of live.exercises) {
      const prev = history.get(ex.exerciseId) ?? []
      let best: PR | null = null
      for (const s of ex.sets) {
        if (!s.done || s.warmup || !s.weight || !s.reps) continue
        const comparable = prev.filter((p) => p.reps >= s.reps!)
        if (!comparable.length) continue
        if (s.weight > Math.max(...comparable.map((p) => p.weight))) {
          if (!best || s.weight > best.weight) best = { exerciseName: ex.name, weight: s.weight, reps: s.reps }
        }
      }
      if (best) prs.push(best)
    }

    const summary: FinishSummary = {
      sessionId: live.sessionId,
      name: live.name,
      durationSeconds,
      volume: live.exercises.reduce((v, ex) => v + ex.sets.reduce((a, s) => a + liveVolume(s), 0), 0),
      exercisesCompleted: live.exercises.filter((ex) => ex.sets.some((s) => s.done)).length,
      setsCompleted: rows.length,
      prs,
      programDayId: live.programDayId,
    }
    setLive(null)
    emitChange('sessions')
    return summary
  }, [live])

  return {
    live,
    starting,
    start,
    updateSet,
    toggleSet,
    toggleFlag,
    addSet,
    removeSet,
    addExercise,
    removeExercise,
    moveExercise,
    supersetWithNext,
    unlinkSuperset,
    setRest,
    dismissRest,
    adjustRest,
    abandon,
    finish,
  }
}

type WorkoutApi = ReturnType<typeof useWorkoutSessionState>
const WorkoutContext = createContext<WorkoutApi | null>(null)

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const api = useWorkoutSessionState()
  return createElement(WorkoutContext.Provider, { value: api }, children)
}

export function useWorkoutSession(): WorkoutApi {
  const ctx = useContext(WorkoutContext)
  if (!ctx) throw new Error('useWorkoutSession must be used inside WorkoutProvider')
  return ctx
}

/** Re-renders every `ms` so timers tick. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function useTotals(live: LiveSession | null) {
  return useMemo(() => {
    if (!live) return { done: 0, total: 0 }
    const all = live.exercises.flatMap((e) => e.sets)
    return { done: all.filter((s) => s.done).length, total: all.length }
  }, [live])
}
