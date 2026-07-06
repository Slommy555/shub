import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { NotePage } from '../../types/notes';

const byPosition = (a: NotePage, b: NotePage) =>
  a.position - b.position || (a.created_at < b.created_at ? -1 : 1);

const tableMissing = (msg: string) =>
  /relation .*note_pages.* does not exist|could not find the table/i.test(msg);

/**
 * Loads the user's note pages, keeps them in sync via realtime, and exposes
 * CRUD + reorder. Mirrors the app's other Supabase hooks (optimistic writes,
 * per-user realtime channel). Position drives sidebar ordering.
 */
export function useNotePages(userId: string | null) {
  const [pages, setPages] = useState<NotePage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pagesRef = useRef<NotePage[]>([]);
  pagesRef.current = pages;

  // --- load ---------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setPages([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error: err } = await supabase
        .from('note_pages')
        .select('*')
        .order('position', { ascending: true });
      if (cancelled) return;
      if (err) {
        console.error('Failed to load note pages:', err.message);
        setError(
          tableMissing(err.message)
            ? 'The notes tables don’t exist yet. Run the 015_notes.sql migration in Supabase.'
            : err.message
        );
      }
      setPages(((data ?? []) as NotePage[]).sort(byPosition));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- realtime -----------------------------------------------------------
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`note_pages-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'note_pages', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setPages((prev) => prev.filter((p) => p.id !== id));
          } else {
            const row = payload.new as NotePage;
            setPages((prev) => {
              const exists = prev.some((p) => p.id === row.id);
              const next = exists ? prev.map((p) => (p.id === row.id ? row : p)) : [...prev, row];
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

  // --- mutations ----------------------------------------------------------
  const createPage = useCallback(
    async (title: string, icon: string | null = null): Promise<NotePage | null> => {
      if (!userId) return null;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const position = pagesRef.current.length
        ? Math.max(...pagesRef.current.map((p) => p.position)) + 1
        : 0;
      const row: NotePage = {
        id,
        user_id: userId,
        title: title.trim() || 'Untitled',
        icon,
        position,
        created_at: now,
        updated_at: now,
      };
      setPages((prev) => [...prev, row].sort(byPosition));
      setError(null);
      const { error: err } = await supabase.from('note_pages').insert({
        id,
        user_id: userId,
        title: row.title,
        icon,
        position,
      });
      if (err) {
        console.error('createPage failed:', err.message);
        setPages((prev) => prev.filter((p) => p.id !== id));
        setError(tableMissing(err.message) ? 'Run the 015_notes.sql migration in Supabase.' : err.message);
        return null;
      }
      return row;
    },
    [userId]
  );

  const renamePage = useCallback(async (id: string, title: string) => {
    const clean = title.trim() || 'Untitled';
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, title: clean } : p)));
    const { error: err } = await supabase
      .from('note_pages')
      .update({ title: clean, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (err) console.error('renamePage failed:', err.message);
  }, []);

  const deletePage = useCallback(async (id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id));
    const { error: err } = await supabase.from('note_pages').delete().eq('id', id);
    if (err) console.error('deletePage failed:', err.message);
  }, []);

  /** Persist a new ordering (array of ids in the desired order). */
  const reorderPages = useCallback(async (orderedIds: string[]) => {
    setPages((prev) => {
      const byId = new Map(prev.map((p) => [p.id, p]));
      return orderedIds
        .map((id, i) => {
          const p = byId.get(id);
          return p ? { ...p, position: i } : null;
        })
        .filter((p): p is NotePage => p != null);
    });
    const updated_at = new Date().toISOString();
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase.from('note_pages').update({ position: i, updated_at }).eq('id', id)
      )
    );
  }, []);

  return { pages, loading, error, createPage, renamePage, deletePage, reorderPages };
}

export type UseNotePages = ReturnType<typeof useNotePages>;
