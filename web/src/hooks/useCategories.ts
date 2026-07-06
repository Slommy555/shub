import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  COLOR_DOT,
  COLOR_STYLES,
  DEFAULT_CATEGORIES,
  type CategoryRecord,
  type ColorKey,
} from '../types';

const byPosition = (a: CategoryRecord, b: CategoryRecord) => a.position - b.position;

/**
 * Loads the user's categories, keeps them synced via realtime, and exposes
 * CRUD. Renaming a category rewrites matching tasks.category; deleting one
 * reassigns its tasks to another category. New users are seeded with defaults.
 */
export function useCategories(userId: string | null) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const seededRef = useRef(false);

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

      if (error) {
        console.error('Failed to load categories:', error.message);
        if (!cancelled) setLoading(false);
        return;
      }

      if (cancelled) return;

      if ((data ?? []).length === 0 && !seededRef.current) {
        seededRef.current = true;
        const rows = DEFAULT_CATEGORIES.map((c, i) => ({
          id: crypto.randomUUID(),
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

  // Realtime
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`categories-rt-${userId}`)
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

  const addCategory = useCallback(
    async (name: string, color: ColorKey) => {
      if (!userId) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const id = crypto.randomUUID();
      setCategories((prev) => {
        const position = prev.length;
        const row: CategoryRecord = {
          id,
          user_id: userId,
          name: trimmed,
          color,
          position,
          created_at: new Date().toISOString(),
        };
        return [...prev, row].sort(byPosition);
      });
      const position = categories.length;
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
        prev.map((c) =>
          c.id === id
            ? { ...c, ...(nextName ? { name: nextName } : {}), ...(patch.color ? { color: patch.color } : {}) }
            : c
        )
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
      if (dbPatch.name) {
        const { error: tErr } = await supabase
          .from('tasks')
          .update({ category: dbPatch.name })
          .eq('user_id', userId!)
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
      // Keep at least one category around.
      const fallback = categories.find((c) => c.id !== id);
      if (!fallback) return;

      setCategories((prev) => prev.filter((c) => c.id !== id));

      // Reassign this category's tasks before removing it.
      const { error: tErr } = await supabase
        .from('tasks')
        .update({ category: fallback.name })
        .eq('user_id', userId!)
        .eq('category', current.name);
      if (tErr) console.error('delete reassignment failed:', tErr.message);

      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) console.error('deleteCategory failed:', error.message);
    },
    [categories, userId]
  );

  const colorFor = useCallback(
    (name: string): string => {
      const cat = categories.find((c) => c.name === name);
      return COLOR_STYLES[cat?.color ?? 'gray'];
    },
    [categories]
  );

  const dotFor = useCallback(
    (name: string): string => {
      const cat = categories.find((c) => c.name === name);
      return COLOR_DOT[cat?.color ?? 'gray'];
    },
    [categories]
  );

  return { categories, loading, addCategory, updateCategory, deleteCategory, colorFor, dotFor };
}

export type UseCategories = ReturnType<typeof useCategories>;
