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

  // Ids we've just written locally (create/update). While an id is in here, a
  // realtime echo for that row is ignored so it can't clobber the fresh local
  // copy before the insert has fully round-tripped (the "note flashes then
  // disappears" race). Cleared after a short settle window.
  const recentWrites = useRef<Map<string, number>>(new Map());
  const markWrite = useCallback((id: string) => {
    recentWrites.current.set(id, Date.now());
    window.setTimeout(() => recentWrites.current.delete(id), 4000);
  }, []);

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
            // Skip echoes for rows we just wrote locally — our optimistic copy
            // is the source of truth until the write settles, so a lagging
            // realtime event can't briefly wipe a freshly created note.
            if (recentWrites.current.has(row.id)) return;
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
        include_in_brief: false,
        created_at: now,
        updated_at: now,
      };
      markWrite(id);
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
        // Surface the failure but KEEP the note in local state so the user
        // doesn't lose their work (a silent rollback here is what made new
        // notes flash then vanish). It'll retry-persist on the next edit.
        console.error('createNote failed — keeping note locally:', err.message);
        if (typeof window !== 'undefined') {
          window.alert(`Couldn't save the note to the server: ${err.message}\n\nIt's kept on this device; check your connection and it will re-sync when you edit it.`);
        }
      }
      return row;
    },
    [userId, markWrite]
  );

  /** Update a note's title, content, and/or daily-brief flag. Stamps `updated_at`. Resolves true on success. */
  const updateNote = useCallback(
    async (
      id: string,
      patch: { title?: string; content?: TiptapDoc; include_in_brief?: boolean }
    ): Promise<boolean> => {
      const updated_at = new Date().toISOString();
      markWrite(id);
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
    [markWrite]
  );

  const deleteNote = useCallback(async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const { error: err } = await supabase.from('notes').delete().eq('id', id);
    if (err) console.error('deleteNote failed:', err.message);
  }, []);

  return { notes, loading, createNote, updateNote, deleteNote };
}

export type UseNotes = ReturnType<typeof useNotes>;
