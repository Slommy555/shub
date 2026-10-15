import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, T, currentUserId } from '../lib/supabase'
import { emitChange, onChange } from '../lib/bus'
import type { Exercise } from '../lib/types'

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(T.exercises)
      .select('*')
      .order('is_default', { ascending: false })
      .order('name')
    if (!error && data) setExercises(data as Exercise[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    return onChange('exercises', load)
  }, [load])

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const create = useCallback(
    async (input: { name: string; muscle_group: string; equipment: string }) => {
      const user_id = await currentUserId()
      const { data, error } = await supabase
        .from(T.exercises)
        .insert({ ...input, user_id, is_default: false })
        .select()
        .single()
      if (error) throw error
      emitChange('exercises')
      return data as Exercise
    },
    [],
  )

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from(T.exercises).delete().eq('id', id).eq('is_default', false)
    if (error) throw error
    emitChange('exercises')
  }, [])

  return { exercises, byId, loading, create, remove, reload: load }
}
