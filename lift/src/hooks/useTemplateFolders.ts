import { useCallback, useEffect, useState } from 'react'
import { supabase, T, currentUserId } from '../lib/supabase'
import { emitChange, onChange } from '../lib/bus'
import type { TemplateFolder } from '../lib/types'

export function useTemplateFolders() {
  const [folders, setFolders] = useState<TemplateFolder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from(T.folders).select('*').order('position').order('created_at')
    if (!error && data) setFolders(data as TemplateFolder[])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    return onChange('folders', load)
  }, [load])

  const create = useCallback(
    async (name: string) => {
      const user_id = await currentUserId()
      const position = folders.length ? Math.max(...folders.map((f) => f.position)) + 1 : 0
      const { error } = await supabase.from(T.folders).insert({ name, user_id, position })
      if (error) throw error
      emitChange('folders')
    },
    [folders],
  )

  const rename = useCallback(async (id: string, name: string) => {
    const { error } = await supabase.from(T.folders).update({ name }).eq('id', id)
    if (error) throw error
    emitChange('folders')
  }, [])

  /** Templates inside fall back to uncategorized (FK is on delete set null). */
  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from(T.folders).delete().eq('id', id)
    if (error) throw error
    emitChange('folders')
    emitChange('templates')
  }, [])

  /** Persist a new order; `ordered` is the full folder list in display order. */
  const reorder = useCallback(async (ordered: TemplateFolder[]) => {
    setFolders(ordered.map((f, i) => ({ ...f, position: i })))
    const results = await Promise.all(
      ordered.map((f, i) => supabase.from(T.folders).update({ position: i }).eq('id', f.id)),
    )
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
  }, [])

  return { folders, setFolders, loading, create, rename, remove, reorder }
}

/** Most recent finished session date per template id. */
export function useTemplateLastUsed() {
  const [lastUsed, setLastUsed] = useState<Map<string, string>>(new Map())

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from(T.sessions)
      .select('template_id, started_at')
      .not('template_id', 'is', null)
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(1000)
    if (error || !data) return
    const map = new Map<string, string>()
    for (const r of data as { template_id: string; started_at: string }[]) {
      if (!map.has(r.template_id)) map.set(r.template_id, r.started_at)
    }
    setLastUsed(map)
  }, [])

  useEffect(() => {
    load()
    return onChange('sessions', load)
  }, [load])

  return lastUsed
}
