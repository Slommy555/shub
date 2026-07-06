// Notes feature types. `content` is Tiptap/ProseMirror JSON, stored verbatim in
// the `notes.content` jsonb column.

/** A ProseMirror/Tiptap node. Loose by design — Tiptap owns the exact shape. */
export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** A Tiptap document (the root node stored in `notes.content`). */
export interface TiptapDoc {
  type: 'doc';
  content: TiptapNode[];
}

/** An empty document — the default body for a fresh note. */
export const EMPTY_DOC: TiptapDoc = { type: 'doc', content: [] };

export interface NotePage {
  id: string;
  user_id: string;
  title: string;
  icon: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  page_id: string;
  title: string;
  content: TiptapDoc;
  position: number;
  /** When true, the note's title + content is pulled into the daily brief. */
  include_in_brief: boolean;
  created_at: string;
  updated_at: string;
}
