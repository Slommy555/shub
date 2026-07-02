import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Note, TiptapDoc } from '../../types/notes';
import { EMPTY_DOC } from '../../types/notes';

const byPosition = (a: Note, b: Note) =>
  a.position - b.position || (a.created_at < b.created_at ? -1 : 1);

/**
 * Loads all of the user's notes (across every page), keeps them in sync via
 * realtime, and exposes CRUD. Grouping by page is done by the caller. Content
 * autosave debouncing lives in NoteEditor; this hook just performs the writes
 * and stamps `updated_at`.
 */
export function useNotes(userId: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;

  // --- load ---------------------------------------------------------------
  useEffect(() => {
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error: err } = await supabase
        .from('notes')
        .select('*')
        .order('position', { ascending: true });
      if (cancelled) return;
      if (err) console.error('Failed to load notes:', err.message);
      setNotes(((data ?? []) as Note[]).sort(byPosition));
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
      .channel(`notes-rt-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id: string }).id;
            setNotes((prev) => prev.filter((n) => n.id !== id));
          } else {
            const row = payload.new as Note;
            setNotes((prev) => {
              const exists = prev.some((n) => n.id === row.id);
              const next = exists ? prev.map((n) => (n.id === row.id ? row : n)) : [...prev, row];
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
  const createNote = useCallback(
    async (
      pageId: string,
      opts?: { title?: string; content?: TiptapDoc }
    ): Promise<Note | null> => {
      if (!userId) return null;
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const inPage = notesRef.current.filter((n) => n.page_id === pageId);
      const position = inPage.length ? Math.max(...inPage.map((n) => n.position)) + 1 : 0;
      const row: Note = {
        id,
        user_id: userId,
        page_id: pageId,
        title: opts?.title?.trim() || 'Untitled',
        content: opts?.content ?? EMPTY_DOC,
        position,
        created_at: now,
        updated_at: now,
      };
      setNotes((prev) => [...prev, row].sort(byPosition));
      const { error: err } = await supabase.from('notes').insert({
        id,
        user_id: userId,
        page_id: pageId,
        title: row.title,
        content: row.content,
        position,
      });
      if (err) {
        console.error('createNote failed:', err.message);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        return null;
      }
      return row;
    },
    [userId]
  );

  /** Update a note's title and/or content. Stamps `updated_at`. Resolves true on success. */
  const updateNote = useCallback(
    async (id: string, patch: { title?: string; content?: TiptapDoc }): Promise<boolean> => {
      const updated_at = new Date().toISOString();
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, ...patch, updated_at } : n)).sort(byPosition)
      );
      const { error: err } = await supabase
        .from('notes')
        .update({ ...patch, updated_at })
        .eq('id', id);
      if (err) {
        console.error('updateNote failed:', err.message);
        return false;
      }
      return true;
    },
    []
  );

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const { error: err } = await supabase.from('notes').delete().eq('id', id);
    if (err) console.error('deleteNote failed:', err.message);
  }, []);

  return { notes, loading, createNote, updateNote, deleteNote };
}

export type UseNotes = ReturnType<typeof useNotes>;
