// Hands a voice-proposed note off to the Notes tab so the user can edit it in
// the full editor before saving ("Edit before saving" in the review card).
// Mirrors workoutHandoff: the value is stashed in sessionStorage, the app
// navigates to the Notes tab, and NotesTab picks it up on mount. The note is
// only persisted once NotesTab creates it — nothing is written on handoff.

import type { TiptapDoc } from '../types/notes';

const KEY = 'pendingNote';

export interface PendingNote {
  /** Existing page to create the note in, if one was matched. */
  pageId: string | null;
  /** Page name to create if no id was matched (or the default page name). */
  pageName: string;
  title: string;
  content: TiptapDoc;
}

export function setPendingNote(note: PendingNote): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(note));
  } catch {
    /* storage unavailable — the handoff just won't happen */
  }
}

export function readPendingNote(): PendingNote | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingNote) : null;
  } catch {
    return null;
  }
}

export function clearPendingNote(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
