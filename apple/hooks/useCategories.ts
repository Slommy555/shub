import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { uuid } from '../lib/id';
import { DEFAULT_CATEGORIES, type CategoryRecord, type ColorKey } from '../lib/types';

const byPosition = (a: CategoryRecord, b: CategoryRecord) => a.position - b.position;

/**
 * Loads the user's categories (seeding defaults for new users) and keeps them
 * synced via realtime. Read-only from mobile for now — used to render category
 * chips and resolve badge colors. Mirrors the web categories table.
 */
export function useCategories(userId: string | null) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);
  // Unique per instance — this hook mounts on multiple screens at once and
  // Supabase channels collide if they share a name (see useTasks).
  const channelIdRef = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!userId) {
      setCategories([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('position', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('Failed to load categories:', error.message);
        setLoading(false);
        return;
      }
      if ((data ?? []).length === 0 && !seededRef.current) {
        seededRef.current = true;
        const rows = DEFAULT_CATEGORIES.map((c, i) => ({
          id: uuid(),
          user_id: userId,
          name: c.name,
          color: c.color,
          position: i,
        }));
        const { error: seedErr } = await supabase.from('categories').insert(rows);
        if (seedErr) console.error('Failed to seed categories:', seedErr.message);
        if (!cancelled) {
          setCategories(rows.map((r) => ({ ...r, created_at: new Date().toISOString() })));
        }
      } else {
        setCategories((data as CategoryRecord[]).sort(byPosition));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`categories-rt-${userId}-${channelIdRef.current}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setCategories((prev) => prev.filter((c) => c.id !== id));
          } else {
            const row = payload.new as CategoryRecord;
            setCategories((prev) => {
              const exists = prev.some((c) => c.id === row.id);
              const next = exists ? prev.map((c) => (c.id === row.id ? row : c)) : [...prev, row];
              return next.sort(byPosition);
            });
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const colorForCategory = useCallback(
    (name: string): ColorKey => categories.find((c) => c.name === name)?.color ?? 'gray',
    [categories]
  );

  const addCategory = useCallback(
    async (name: string, color: ColorKey) => {
      if (!userId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = uuid();
      const position = categories.length;
      const row: CategoryRecord = {
        id,
        user_id: userId,
        name: trimmed,
        color,
        position,
        created_at: new Date().toISOString(),
      };
      setCategories((prev) => [...prev, row].sort(byPosition));
      const { error } = await supabase
        .from('categories')
        .insert({ id, user_id: userId, name: trimmed, color, position });
      if (error) console.error('addCategory failed:', error.message);
    },
    [userId, categories.length]
  );

  const updateCategory = useCallback(
    async (id: string, patch: { name?: string; color?: ColorKey }) => {
      const current = categories.find((c) => c.id === id);
      if (!current) return;
      const nextName = patch.name?.trim();

      setCategories((prev) =>
        prev
          .map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(nextName ? { name: nextName } : {}),
                  ...(patch.color ? { color: patch.color } : {}),
                }
              : c
          )
          .sort(byPosition)
      );

      const dbPatch: { name?: string; color?: ColorKey } = {};
      if (nextName && nextName !== current.name) dbPatch.name = nextName;
      if (patch.color) dbPatch.color = patch.color;
      if (Object.keys(dbPatch).length === 0) return;

      const { error } = await supabase.from('categories').update(dbPatch).eq('id', id);
      if (error) {
        console.error('updateCategory failed:', error.message);
        return;
      }
      // Rename: rewrite any tasks pointing at the old name.
      if (dbPatch.name && userId) {
        const { error: tErr } = await supabase
          .from('tasks')
          .update({ category: dbPatch.name })
          .eq('user_id', userId)
          .eq('category', current.name);
        if (tErr) console.error('rename task reassignment failed:', tErr.message);
      }
    },
    [categories, userId]
  );

  const deleteCategory = useCallback(
    async (id: string) => {
      const current = categories.find((c) => c.id === id);
      if (!current) return;
      // Keep at least one category around, and reassign this one's tasks to it.
      const fallback = categories.find((c) => c.id !== id);
      if (!fallback || !userId) return;

      setCategories((prev) => prev.filter((c) => c.id !== id));

      const { error: tErr } = await supabase
        .from('tasks')
        .update({ category: fallback.name })
        .eq('user_id', userId)
        .eq('category', current.name);
      if (tErr) console.error('delete reassignment failed:', tErr.message);

      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) console.error('deleteCategory failed:', error.message);
    },
    [categories, userId]
  );

  return {
    categories,
    loading,
    colorForCategory,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}
