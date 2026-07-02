import { useEffect, useMemo, useRef, useState } from 'react';
import { useNotePages } from '../../hooks/notes/useNotePages';
import { useNotes } from '../../hooks/notes/useNotes';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { Note } from '../../types/notes';
import { clearPendingNote, readPendingNote } from '../../lib/noteHandoff';
import PageSidebar from './PageSidebar';
import NoteEditor from './NoteEditor';

/** The Notes tab: page sidebar + rich-text editor. On desktop both are visible;
 *  on mobile it's a two-screen flow (page list ↔ full-screen editor). */
export default function NotesTab({ userId }: { userId: string }) {
  const pagesApi = useNotePages(userId);
  const notesApi = useNotes(userId);
  const isMobile = useIsMobile();

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mobileView, setMobileView] = useState<'list' | 'editor'>('list');

  const { pages, createPage } = pagesApi;
  const { notes, createNote } = notesApi;

  const notesByPage = useMemo(() => {
    const map = new Map<string, Note[]>();
    for (const n of notes) {
      const arr = map.get(n.page_id) ?? [];
      arr.push(n);
      map.set(n.page_id, arr);
    }
    return map;
  }, [notes]);

  const selectedNote = selectedNoteId ? notes.find((n) => n.id === selectedNoteId) ?? null : null;
  const selectedPage = selectedNote ? pages.find((p) => p.id === selectedNote.page_id) ?? null : null;

  function selectNote(note: Note) {
    setSelectedNoteId(note.id);
    setExpanded((prev) => new Set(prev).add(note.page_id));
    setMobileView('editor');
  }

  function toggleExpand(pageId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  async function handleCreatePage(title: string) {
    const page = await createPage(title);
    if (page) setExpanded((prev) => new Set(prev).add(page.id));
  }

  async function handleCreateNote(pageId: string) {
    const note = await createNote(pageId);
    if (note) selectNote(note);
  }

  // Voice "Edit before saving" handoff: create the proposed note and open it.
  const handledHandoff = useRef(false);
  useEffect(() => {
    if (handledHandoff.current || pagesApi.loading || notesApi.loading) return;
    const pending = readPendingNote();
    if (!pending) return;
    handledHandoff.current = true;
    clearPendingNote();
    (async () => {
      let pageId = pending.pageId && pages.some((p) => p.id === pending.pageId) ? pending.pageId : null;
      if (!pageId) {
        const existing = pages.find((p) => p.title.toLowerCase() === pending.pageName.trim().toLowerCase());
        pageId = existing ? existing.id : (await createPage(pending.pageName))?.id ?? null;
      }
      if (!pageId) return;
      const note = await createNote(pageId, { title: pending.title, content: pending.content });
      if (note) selectNote(note);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagesApi.loading, notesApi.loading]);

  const sidebar = (
    <PageSidebar
      pages={pages}
      notesByPage={notesByPage}
      selectedNoteId={selectedNoteId}
      expanded={expanded}
      onToggleExpand={toggleExpand}
      onSelectNote={selectNote}
      onCreatePage={handleCreatePage}
      onRenamePage={pagesApi.renamePage}
      onDeletePage={(id) => {
        pagesApi.deletePage(id);
        if (selectedNote?.page_id === id) setSelectedNoteId(null);
      }}
      onReorderPages={pagesApi.reorderPages}
      onCreateNote={handleCreateNote}
    />
  );

  const editor = selectedNote ? (
    <NoteEditor
      key={selectedNote.id}
      note={selectedNote}
      pageTitle={selectedPage?.title ?? 'Notes'}
      onUpdate={notesApi.updateNote}
      onDelete={(id) => {
        notesApi.deleteNote(id);
        setSelectedNoteId(null);
        setMobileView('list');
      }}
      onBack={() => setMobileView('list')}
    />
  ) : (
    <EmptyState />
  );

  // Mobile: one screen at a time.
  if (isMobile) {
    return (
      <div className="h-screen">
        {mobileView === 'editor' && selectedNote ? editor : sidebar}
      </div>
    );
  }

  // Desktop: sidebar + editor side by side.
  return (
    <div className="flex h-screen">
      <aside className="w-72 shrink-0 border-r border-gray-200 dark:border-gray-800">{sidebar}</aside>
      <div className="min-w-0 flex-1">{editor}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid h-full place-items-center p-8 text-center">
      <div>
        <svg
          width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.4" className="mx-auto text-gray-300 dark:text-gray-700"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
        <p className="mt-3 text-sm font-medium text-gray-500 dark:text-gray-400">
          Select a note or create a new one
        </p>
      </div>
    </div>
  );
}
