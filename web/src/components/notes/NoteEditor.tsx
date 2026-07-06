import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import type { Note, TiptapDoc } from '../../types/notes';
import { noteExtensions } from '../../lib/notes/tiptap';

interface Props {
  note: Note;
  pageTitle: string;
  onUpdate: (
    id: string,
    patch: { title?: string; content?: TiptapDoc; include_in_brief?: boolean }
  ) => Promise<boolean>;
  onDelete: (id: string) => void;
  /** Mobile: shows a back button that returns to the page/list screen. */
  onBack?: () => void;
}

const SAVE_DEBOUNCE_MS = 1000;
type SaveState = 'idle' | 'saving' | 'saved';

/**
 * The main note editing surface: editable title, a Tiptap rich-text body, and
 * debounced autosave (1s after typing stops) with a transient "Saved" pill.
 * Breadcrumb shows the owning page; a confirm-guarded delete removes the note.
 */
export default function NoteEditor({ note, pageTitle, onUpdate, onDelete, onBack }: Props) {
  const [title, setTitle] = useState(note.title);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const titleTimer = useRef<number | null>(null);
  const contentTimer = useRef<number | null>(null);
  const savedHideTimer = useRef<number | null>(null);
  // Latest note id, so debounced callbacks always target the right row.
  const noteIdRef = useRef(note.id);
  noteIdRef.current = note.id;

  const flashSaved = useCallback(() => {
    setSaveState('saved');
    if (savedHideTimer.current) window.clearTimeout(savedHideTimer.current);
    savedHideTimer.current = window.setTimeout(() => setSaveState('idle'), 1600);
  }, []);

  const commit = useCallback(
    async (patch: { title?: string; content?: TiptapDoc }) => {
      setSaveState('saving');
      const ok = await onUpdate(noteIdRef.current, patch);
      if (ok) flashSaved();
      else setSaveState('idle');
    },
    [onUpdate, flashSaved]
  );

  // Recreate the editor when the selected note changes so its content resets
  // cleanly (avoids clobbering an in-progress edit with realtime updates).
  const editor = useEditor(
    {
      extensions: noteExtensions('Start writing…'),
      content: note.content,
      onUpdate: ({ editor }) => {
        if (contentTimer.current) window.clearTimeout(contentTimer.current);
        const json = editor.getJSON() as TiptapDoc;
        contentTimer.current = window.setTimeout(() => void commit({ content: json }), SAVE_DEBOUNCE_MS);
      },
    },
    [note.id]
  );

  // Keep the title field in sync when switching notes.
  useEffect(() => {
    setTitle(note.title);
  }, [note.id, note.title]);

  // Flush any pending save when leaving the note or unmounting.
  useEffect(() => {
    return () => {
      if (contentTimer.current) {
        window.clearTimeout(contentTimer.current);
        if (editor) void onUpdate(noteIdRef.current, { content: editor.getJSON() as TiptapDoc });
      }
      if (titleTimer.current) window.clearTimeout(titleTimer.current);
      if (savedHideTimer.current) window.clearTimeout(savedHideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  function onTitleChange(next: string) {
    setTitle(next);
    if (titleTimer.current) window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => void commit({ title: next.trim() || 'Untitled' }), SAVE_DEBOUNCE_MS);
  }

  function confirmDelete() {
    if (window.confirm('Delete this note? This cannot be undone.')) onDelete(note.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Breadcrumb + actions */}
      <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to pages"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 sm:hidden"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-gray-400">
          {pageTitle} <span className="px-1">/</span>
          <span className="text-gray-600 dark:text-gray-300">{title || 'Untitled'}</span>
        </p>
        <span
          className={[
            'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium transition-opacity',
            saveState === 'saved'
              ? 'bg-green-100 text-green-700 opacity-100 dark:bg-green-500/15 dark:text-green-300'
              : saveState === 'saving'
                ? 'text-gray-400 opacity-100'
                : 'opacity-0',
          ].join(' ')}
        >
          {saveState === 'saving' ? 'Saving…' : 'Saved'}
        </span>
        <button
          type="button"
          onClick={confirmDelete}
          aria-label="Delete note"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          </svg>
        </button>
      </div>

      {/* Scrollable editor body */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="pb-fab mx-auto w-full max-w-2xl px-4 py-5 sm:px-6">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onKeyDown={(e) => {
              // Enter in the title must never submit/close/clear the note — it
              // just moves focus into the body so the user can start writing.
              if (e.key === 'Enter') {
                e.preventDefault();
                editor?.commands.focus('end');
              }
            }}
            placeholder="Untitled"
            aria-label="Note title"
            className="w-full bg-transparent text-2xl font-bold tracking-tight text-gray-900 outline-none placeholder:text-gray-300 dark:text-gray-100 dark:placeholder:text-gray-600"
          />
          {/* Flag this note to be pulled into the daily brief (Telegram / push). */}
          <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              type="checkbox"
              checked={note.include_in_brief}
              onChange={(e) => void onUpdate(note.id, { include_in_brief: e.target.checked })}
              className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-gray-600 focus:ring-gray-400/40 dark:border-gray-600 dark:bg-gray-800"
            />
            Daily update
          </label>
          <div className="mt-3">
            <Toolbar editor={editor} />
            <EditorContent editor={editor} className="mt-2" />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Toolbar ----------------------------------------------------------------

interface ToolbarState {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  h1: boolean;
  h2: boolean;
  h3: boolean;
  bullet: boolean;
  ordered: boolean;
  task: boolean;
  quote: boolean;
}

function Toolbar({ editor }: { editor: Editor | null }) {
  const active = useEditorState<ToolbarState>({
    editor,
    selector: ({ editor }): ToolbarState => ({
      bold: !!editor?.isActive('bold'),
      italic: !!editor?.isActive('italic'),
      strike: !!editor?.isActive('strike'),
      h1: !!editor?.isActive('heading', { level: 1 }),
      h2: !!editor?.isActive('heading', { level: 2 }),
      h3: !!editor?.isActive('heading', { level: 3 }),
      bullet: !!editor?.isActive('bulletList'),
      ordered: !!editor?.isActive('orderedList'),
      task: !!editor?.isActive('taskList'),
      quote: !!editor?.isActive('blockquote'),
    }),
  });

  if (!editor || !active) return null;
  const a = active;

  return (
    <div className="sticky top-0 z-10 -mx-1 flex flex-wrap gap-0.5 rounded-xl border border-gray-200 bg-white/95 p-1 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
      <Btn label="Bold" active={a.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </Btn>
      <Btn label="Italic" active={a.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </Btn>
      <Btn label="Strikethrough" active={a.strike} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </Btn>
      <Divider />
      <Btn label="Heading 1" active={a.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </Btn>
      <Btn label="Heading 2" active={a.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </Btn>
      <Btn label="Heading 3" active={a.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </Btn>
      <Divider />
      <Btn label="Bullet list" active={a.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        •
      </Btn>
      <Btn label="Numbered list" active={a.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1.
      </Btn>
      <Btn label="Checklist" active={a.task} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        ☑
      </Btn>
      <Btn label="Quote" active={a.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </Btn>
      <Btn label="Divider" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </Btn>
    </div>
  );
}

function Btn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={[
        'grid h-9 min-w-9 place-items-center rounded-lg px-2 text-sm transition-colors max-sm:h-11 max-sm:min-w-11',
        active
          ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 my-1 w-px self-stretch bg-gray-200 dark:bg-gray-700" />;
}
