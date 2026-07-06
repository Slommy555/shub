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

  return { categories, loading, colorForCategory };
}
