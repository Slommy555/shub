import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, T, currentUserId } from '../lib/supabase'
import { emitChange, onChange } from '../lib/bus'
import type { LiveExercise, Template, TemplateExercise } from '../lib/types'

export interface TemplateWithExercises extends Template {
  exercises: TemplateExercise[]
}

/** Rough duration: ~40s per working set plus its rest, rounded to 5 min. */
export function estimateMinutes(t: TemplateWithExercises): number {
  const secs = t.exercises.reduce((sum, e) => sum + e.default_sets * (40 + e.rest_seconds), 0)
  return Math.max(5, Math.round(secs / 60 / 5) * 5)
}

export function useTemplates() {
  const [templates, setTemplates] = useState<TemplateWithExercises[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(T.templates)
      .select(`*, exercises:${T.templateExercises}(*)`)
      .order('created_at')
    if (!error && data) {
      setTemplates(
        (data as TemplateWithExercises[]).map((t) => ({
          ...t,
          exercises: [...t.exercises].sort((a, b) => a.position - b.position),
        })),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    return onChange('templates', load)
  }, [load])

  const byId = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])

  const create = useCallback(async (name: string, day_label?: string) => {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from(T.templates)
      .insert({ name, day_label: day_label || null, user_id })
      .select()
      .single()
    if (error) throw error
    emitChange('templates')
    return data as Template
  }, [])

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from(T.templates).delete().eq('id', id)
    if (error) throw error
    emitChange('templates')
    emitChange('programs')
  }, [])

  const moveToFolder = useCallback(async (id: string, folderId: string | null) => {
    const { error } = await supabase.from(T.templates).update({ folder_id: folderId }).eq('id', id)
    if (error) throw error
    emitChange('templates')
  }, [])

  return { templates, byId, loading, create, remove, moveToFolder, reload: load }
}

export type TemplateExerciseInput = Omit<TemplateExercise, 'id' | 'template_id' | 'position'>

/**
 * Upsert a template from the editor: insert or rename it, then replace its
 * exercise list (delete every template_exercises row, re-insert in order).
 */
export async function saveTemplate(input: {
  id: string | null
  name: string
  folderId?: string | null
  exercises: TemplateExerciseInput[]
}): Promise<string> {
  let id = input.id
  if (id) {
    const { error } = await supabase.from(T.templates).update({ name: input.name }).eq('id', id)
    if (error) throw error
  } else {
    const user_id = await currentUserId()
    const { data, error } = await supabase
      .from(T.templates)
      .insert({ name: input.name, user_id, folder_id: input.folderId ?? null })
      .select('id')
      .single()
    if (error) throw error
    id = (data as { id: string }).id
  }
  const del = await supabase.from(T.templateExercises).delete().eq('template_id', id)
  if (del.error) throw del.error
  if (input.exercises.length) {
    const rows = input.exercises.map((e, i) => ({ ...e, template_id: id, position: i }))
    const ins = await supabase.from(T.templateExercises).insert(rows)
    if (ins.error) throw ins.error
  }
  emitChange('templates')
  emitChange('programs')
  return id
}

/**
 * Overwrite a template's exercise list from session state, keyed by template id.
 * Deletes every template_exercises row for the template, then re-inserts.
 */
export async function saveSessionToTemplate(templateId: string, exercises: LiveExercise[]) {
  const rows = exercises.map((ex, i) => {
    const working = ex.sets.filter((s) => !s.warmup)
    const basis = working.length ? working : ex.sets
    const weights = basis.map((s) => s.weight).filter((w): w is number => w != null)
    const lastReps = [...basis].reverse().find((s) => s.reps != null)?.reps
    return {
      template_id: templateId,
      exercise_id: ex.exerciseId,
      position: i,
      default_sets: Math.max(1, basis.length),
      default_reps: lastReps ?? 10,
      default_weight: weights.length ? Math.max(...weights) : null,
      superset_group_id: ex.supersetGroupId,
      rest_seconds: ex.restSeconds,
    }
  })
  const del = await supabase.from(T.templateExercises).delete().eq('template_id', templateId)
  if (del.error) throw del.error
  if (rows.length) {
    const ins = await supabase.from(T.templateExercises).insert(rows)
    if (ins.error) throw ins.error
  }
  emitChange('templates')
}
