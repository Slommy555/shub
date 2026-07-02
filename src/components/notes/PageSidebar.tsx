import { useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Note, NotePage } from '../../types/notes';
import ContextMenu from '../ContextMenu';
import NoteListItem from './NoteListItem';

interface Props {
  pages: NotePage[];
  notesByPage: Map<string, Note[]>;
  selectedNoteId: string | null;
  expanded: Set<string>;
  onToggleExpand: (pageId: string) => void;
  onSelectNote: (note: Note) => void;
  onCreatePage: (title: string) => void;
  onRenamePage: (id: string, title: string) => void;
  onDeletePage: (id: string) => void;
  onReorderPages: (orderedIds: string[]) => void;
  onCreateNote: (pageId: string) => void;
}

/** Left sidebar: draggable pages, each expandable to its notes, with inline
 *  create/rename and a confirm-guarded delete. */
export default function PageSidebar(props: Props) {
  const { pages, onReorderPages } = props;
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function submitNewPage() {
    const t = newTitle.trim();
    if (t) props.onCreatePage(t);
    setNewTitle('');
    setCreating(false);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = pages.map((p) => p.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorderPages(ids);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-sm font-bold tracking-tight">Pages</h2>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {pages.length === 0 && !creating && (
          <p className="px-2 py-6 text-center text-xs text-gray-400">
            No pages yet. Create one below.
          </p>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            {pages.map((page) => (
              <SortablePageRow
                key={page.id}
                page={page}
                notes={props.notesByPage.get(page.id) ?? []}
                expanded={props.expanded.has(page.id)}
                selectedNoteId={props.selectedNoteId}
                onToggleExpand={() => props.onToggleExpand(page.id)}
                onSelectNote={props.onSelectNote}
                onRename={(title) => props.onRenamePage(page.id, title)}
                onDelete={() => props.onDeletePage(page.id)}
                onCreateNote={() => props.onCreateNote(page.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        {creating && (
          <div className="mt-1 px-1">
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={submitNewPage}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitNewPage();
                if (e.key === 'Escape') {
                  setNewTitle('');
                  setCreating(false);
                }
              }}
              placeholder="Page name…"
              className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-600 dark:bg-gray-950"
            />
          </div>
        )}
      </div>

      {/* New page */}
      <div className="border-t border-gray-100 p-2 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New page
        </button>
      </div>
    </div>
  );
}

function SortablePageRow({
  page,
  notes,
  expanded,
  selectedNoteId,
  onToggleExpand,
  onSelectNote,
  onRename,
  onDelete,
  onCreateNote,
}: {
  page: NotePage;
  notes: Note[];
  expanded: boolean;
  selectedNoteId: string | null;
  onToggleExpand: () => void;
  onSelectNote: (note: Note) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onCreateNote: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: page.id,
  });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(page.title);
  const longPress = useRef<number | null>(null);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
  };

  function commitRename() {
    setRenaming(false);
    if (draft.trim() && draft.trim() !== page.title) onRename(draft.trim());
    else setDraft(page.title);
  }

  function confirmDelete() {
    if (
      window.confirm(
        `Delete “${page.title}”? All notes inside this page will be permanently deleted.`
      )
    ) {
      onDelete();
    }
  }

  const openMenu = (x: number, y: number) => setMenu({ x, y });

  return (
    <div ref={setNodeRef} style={style}>
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          openMenu(e.clientX, e.clientY);
        }}
        onPointerDown={(e) => {
          // Long-press (touch) opens the same rename/delete menu.
          if (e.pointerType !== 'touch') return;
          const { clientX, clientY } = e;
          longPress.current = window.setTimeout(() => openMenu(clientX, clientY), 500);
        }}
        onPointerUp={() => {
          if (longPress.current) window.clearTimeout(longPress.current);
        }}
        onPointerCancel={() => {
          if (longPress.current) window.clearTimeout(longPress.current);
        }}
        className="group flex items-center gap-1 rounded-lg px-1 hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        {/* Drag handle */}
        <button
          type="button"
          aria-label="Drag to reorder page"
          className="grid h-11 w-6 shrink-0 cursor-grab touch-none place-items-center text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600"
          {...attributes}
          {...listeners}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" />
            <circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" />
            <circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
          </svg>
        </button>

        {renaming ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') {
                setDraft(page.title);
                setRenaming(false);
              }
            }}
            className="my-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm outline-none dark:border-gray-600 dark:bg-gray-950"
          />
        ) : (
          <button
            type="button"
            onClick={onToggleExpand}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-2.5 text-left text-sm font-medium text-gray-700 dark:text-gray-200"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
            <span className="shrink-0">{page.icon ?? '📄'}</span>
            <span className="min-w-0 flex-1 truncate">{page.title}</span>
            <span className="shrink-0 text-[11px] text-gray-400">{notes.length || ''}</span>
          </button>
        )}

        {/* Overflow menu trigger */}
        <button
          type="button"
          onClick={(e) => openMenu(e.clientX, e.clientY)}
          aria-label="Page options"
          className="grid h-11 w-8 shrink-0 place-items-center rounded-lg text-gray-400 opacity-0 hover:bg-gray-200 group-hover:opacity-100 max-sm:opacity-100 dark:hover:bg-gray-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" />
          </svg>
        </button>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Rename', onClick: () => setRenaming(true) },
            { label: 'Delete page', danger: true, onClick: confirmDelete },
          ]}
        />
      )}

      {/* Notes within the page */}
      {expanded && (
        <div className="mb-1 ml-6 border-l border-gray-200 pl-1 dark:border-gray-800">
          {notes.map((n) => (
            <NoteListItem
              key={n.id}
              note={n}
              selected={n.id === selectedNoteId}
              onSelect={() => onSelectNote(n)}
            />
          ))}
          <button
            type="button"
            onClick={onCreateNote}
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-2 text-left text-xs font-medium text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 max-sm:py-2.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            New note
          </button>
        </div>
      )}
    </div>
  );
}
