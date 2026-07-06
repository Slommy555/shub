import type { Note } from '../../types/notes';

interface Props {
  note: Note;
  selected: boolean;
  onSelect: () => void;
}

/** A single note row inside an expanded page in the sidebar (title only). */
export default function NoteListItem({ note, selected, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors max-sm:py-2.5',
        selected
          ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-60">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M8 13h8M8 17h5" />
      </svg>
      <span className="min-w-0 flex-1 truncate">{note.title || 'Untitled'}</span>
    </button>
  );
}
