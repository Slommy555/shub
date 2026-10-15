import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, T } from '../lib/supabase'
import { onChange } from '../lib/bus'
import type { WorkoutSet } from '../lib/types'

export interface LoggedSet extends WorkoutSet {
  started_at: string
}

export interface ExerciseSessionStat {
  sessionId: string
  date: string
  sets: number
  volume: number
  topWeight: number
  topReps: number
  bestReps: number
  isPR: boolean
}

export interface ExerciseRecords {
  bestWeight: { weight: number; reps: number } | null
  bestVolume: number
  bestReps: { reps: number; weight: number } | null
}

export function setVolume(s: Pick<WorkoutSet, 'weight' | 'reps' | 'is_warmup' | 'drop_weight' | 'drop_reps'>): number {
  if (s.is_warmup) return 0
  const main = (s.weight ?? 0) * (s.reps ?? 0)
  const drop = (s.drop_weight ?? 0) * (s.drop_reps ?? 0)
  return main + drop
}

/**
 * Per-session aggregates for one exercise, oldest first. A session is a PR
 * when its top weight beats every earlier session's top weight.
 */
export function exerciseSessions(sets: LoggedSet[], exerciseId: string): ExerciseSessionStat[] {
  const bySession = new Map<string, LoggedSet[]>()
  for (const s of sets) {
    if (s.exercise_id !== exerciseId) continue
    const list = bySession.get(s.session_id) ?? []
    list.push(s)
    bySession.set(s.session_id, list)
  }
  const rows = [...bySession.entries()]
    .map(([sessionId, list]) => {
      const working = list.filter((s) => !s.is_warmup)
      const basis = working.length ? working : list
      const top = basis.reduce(
        (best, s) =>
          (s.weight ?? 0) > best.w || ((s.weight ?? 0) === best.w && (s.reps ?? 0) > best.r)
            ? { w: s.weight ?? 0, r: s.reps ?? 0 }
            : best,
        { w: 0, r: 0 },
      )
      return {
        sessionId,
        date: list[0].started_at,
        sets: working.length,
        volume: list.reduce((v, s) => v + setVolume(s), 0),
        topWeight: top.w,
        topReps: top.r,
        bestReps: Math.max(0, ...basis.map((s) => s.reps ?? 0)),
        isPR: false,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  let best = -1
  rows.forEach((r, i) => {
    if (i > 0 && r.topWeight > best) r.isPR = true
    best = Math.max(best, r.topWeight)
  })
  return rows
}

export function exerciseRecords(sets: LoggedSet[], exerciseId: string): ExerciseRecords {
  const mine = sets.filter((s) => s.exercise_id === exerciseId && !s.is_warmup)
  let bestWeight: ExerciseRecords['bestWeight'] = null
  let bestReps: ExerciseRecords['bestReps'] = null
  for (const s of mine) {
    const w = s.weight ?? 0
    const r = s.reps ?? 0
    if (!bestWeight || w > bestWeight.weight || (w === bestWeight.weight && r > bestWeight.reps))
      bestWeight = { weight: w, reps: r }
    if (!bestReps || r > bestReps.reps || (r === bestReps.reps && w > bestReps.weight))
      bestReps = { reps: r, weight: w }
  }
  const bestVolume = Math.max(0, ...exerciseSessions(sets, exerciseId).map((s) => s.volume))
  return { bestWeight, bestVolume, bestReps }
}

export function useProgress() {
  const [sets, setSets] = useState<LoggedSet[]>([])
  const [sessionCount, setSessionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [setsRes, countRes] = await Promise.all([
      supabase
        .from(T.sets)
        .select(`*, session:${T.sessions}!inner(started_at, finished_at)`)
        .not('session.finished_at', 'is', null)
        .order('logged_at', { ascending: true })
        .limit(10000),
      supabase.from(T.sessions).select('id', { count: 'exact', head: true }).not('finished_at', 'is', null),
    ])
    if (!setsRes.error && setsRes.data) {
      setSets(
        (setsRes.data as (WorkoutSet & { session: { started_at: string } })[]).map(({ session, ...s }) => ({
          ...s,
          started_at: session.started_at,
        })),
      )
    }
    if (!countRes.error) setSessionCount(countRes.count ?? 0)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    return onChange('sessions', load)
  }, [load])

  const totalVolume = useMemo(() => sets.reduce((v, s) => v + setVolume(s), 0), [sets])

  /** Exercise ids ordered by most recently logged. */
  const recentExerciseIds = useMemo(() => {
    const seen = new Map<string, string>()
    for (const s of sets) {
      const prev = seen.get(s.exercise_id)
      if (!prev || s.started_at > prev) seen.set(s.exercise_id, s.started_at)
    }
    return [...seen.entries()].sort((a, b) => b[1].localeCompare(a[1])).map(([id]) => id)
  }, [sets])

  return { sets, sessionCount, totalVolume, recentExerciseIds, loading, reload: load }
}
