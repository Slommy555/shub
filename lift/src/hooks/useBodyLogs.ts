import { useCallback, useEffect, useState } from 'react'
import { supabase, T, currentUserId } from '../lib/supabase'
import { emitChange, onChange } from '../lib/bus'
import { isoDate } from '../lib/format'
import type { BodyLog, BodyLogType } from '../lib/types'

export function useBodyLogs(type: BodyLogType) {
  const [logs, setLogs] = useState<BodyLog[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(T.bodyLogs)
      .select('*')
      .eq('type', type)
      .order('logged_at', { ascending: false })
    if (!error && data) setLogs(data as BodyLog[])
    setLoading(false)
  }, [type])

  useEffect(() => {
    setLoading(true)
    load()
    return onChange('body', load)
  }, [load])

  /** One entry per day per type: logging again today overwrites today's value. */
  const log = useCallback(
    async (value: number) => {
      const user_id = await currentUserId()
      const { error } = await supabase
        .from(T.bodyLogs)
        .upsert({ user_id, type, value, logged_at: isoDate() }, { onConflict: 'user_id,type,logged_at' })
      if (error) throw error
      emitChange('body')
    },
    [type],
  )

  const remove = useCallback(async (id: string) => {
    setLogs((prev) => prev.filter((l) => l.id !== id))
    const { error } = await supabase.from(T.bodyLogs).delete().eq('id', id)
    if (error) {
      load()
      throw error
    }
    emitChange('body')
  }, [load])

  return { logs, loading, log, remove }
}
