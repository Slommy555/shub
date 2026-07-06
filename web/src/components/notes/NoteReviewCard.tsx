import { EditorContent, useEditor } from '@tiptap/react';
import type { NoteReviewModel } from '../../lib/claudeRouter';
import { noteExtensions } from '../../lib/notes/tiptap';

const NEW_PAGE = '__new__';

interface Props {
  model: NoteReviewModel;
  onChange: (patch: Partial<NoteReviewModel>) => void;
  onDismiss: () => void;
  /** Open the full editor with this note pre-filled instead of saving inline. */
  onEdit: () => void;
}

/**
 * Voice-created note review card: editable title, a page picker (choose an
 * existing page or create a new one), and a read-only preview of the formatted
 * content. Saving happens via the panel's global confirm; "Edit before saving"
 * hands the note off to the full Notes editor.
 */
export default function NoteReviewCard({ model, onChange, onDismiss, onEdit }: Props) {
  const preview = useEditor(
    {
      editable: false,
      extensions: noteExtensions(''),
      content: model.content,
    },
    [model.id, model.content]
  );

  function onSelectPage(value: string) {
    if (value === NEW_PAGE) {
      onChange({ pageId: null });
      return;
    }
    const page = model.pages.find((p) => p.id === value);
    if (page) onChange({ pageId: page.id, pageName: page.title });
  }

  const isNew = model.pageId == null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-start gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6M8 13h8M8 17h5" />
          </svg>
        </span>
        <input
          value={model.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Note title"
          aria-label="Note title"
          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm font-medium dark:border-gray-700 dark:bg-gray-950"
        />
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Discard note"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Page picker */}
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0 text-xs text-gray-400">Save to</span>
        <select
          value={model.pageId ?? NEW_PAGE}
          onChange={(e) => onSelectPage(e.target.value)}
          aria-label="Page"
          className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
        >
          {model.pages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
          <option value={NEW_PAGE}>＋ New page…</option>
        </select>
      </div>
      {isNew && (
        <input
          value={model.pageName}
          onChange={(e) => onChange({ pageName: e.target.value })}
          placeholder="New page name"
          aria-label="New page name"
          className="mt-2 w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-950"
        />
      )}

      {/* Formatted preview */}
      <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-950/50">
        <EditorContent editor={preview} />
      </div>

      <button
        type="button"
        onClick={onEdit}
        className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Edit before saving →
      </button>
    </div>
  );
}
