// Execution handlers for the voice assistant. Each takes the already-reviewed
// data (the user confirmed it) and performs the write. All Supabase writes go
// through the existing authed client. Errors are logged and collected, never
// thrown, so one failing section doesn't abort the rest.

import { supabase } from './supabase';
import { todayISO } from './dates';
import { setPendingWorkout } from './workoutHandoff';
import type {
  HabitReviewModel,
  NoteReviewModel,
  WeightReviewModel,
  WorkoutReviewModel,
} from './claudeRouter';

const uid = () => crypto.randomUUID();

// 1. Habits ----------------------------------------------------------------
export async function handleCompleteHabits(
  model: HabitReviewModel,
  userId: string
): Promise<void> {
  if (model.targets.length === 0) return;
  const date = todayISO();
  const rows = model.targets.map((h) => ({
    id: uid(),
    user_id: userId,
    habit_id: h.id,
    date,
  }));
  // Ignore duplicates (unique on habit_id+date) so re-confirming is safe.
  const { error } = await supabase.from('habit_logs').upsert(rows, {
    onConflict: 'habit_id,date',
    ignoreDuplicates: true,
  });
  if (error) console.error('handleCompleteHabits failed:', error.message);
}

// 2. Workout ---------------------------------------------------------------
/** Navigation is handled by the caller; this just records what to start. */
export function handleStartWorkout(
  model: WorkoutReviewModel,
  navigate: (tab: 'workout') => void
): void {
  if (model.freestyle || !model.matchedName) {
    setPendingWorkout({ mode: 'freestyle' });
  } else {
    setPendingWorkout({ mode: 'template', name: model.matchedName });
  }
  navigate('workout');
}

// 3. Weight ----------------------------------------------------------------
export async function handleLogWeight(model: WeightReviewModel, userId: string): Promise<void> {
  const { error } = await supabase.from('body_weight_logs').insert({
    id: uid(),
    user_id: userId,
    weight_lbs: model.weight_lbs,
    logged_at: todayISO(),
    notes: model.notes,
  });
  if (error) console.error('handleLogWeight failed:', error.message);
}

// 4. Notes -----------------------------------------------------------------
/**
 * Save a voice-proposed note. Resolves the target page — using the matched
 * existing page, an existing page whose title matches (case-insensitive), or a
 * newly created page — then inserts the note with its parsed Tiptap content.
 */
export async function handleWriteNote(model: NoteReviewModel, userId: string): Promise<void> {
  let pageId = model.pageId;

  if (!pageId) {
    // Re-check for an existing page by title (the user may have created it since
    // parsing, or it's the default "Quick Notes" page) before making a new one.
    const wanted = model.pageName.trim();
    const { data: existing } = await supabase
      .from('note_pages')
      .select('id, title')
      .ilike('title', wanted);
    pageId = existing?.[0]?.id ?? null;

    if (!pageId) {
      const newPageId = uid();
      const { error: pErr } = await supabase.from('note_pages').insert({
        id: newPageId,
        user_id: userId,
        title: wanted || 'Untitled',
      });
      if (pErr) {
        console.error('handleWriteNote: create page failed:', pErr.message);
        return;
      }
      pageId = newPageId;
    }
  }

  const { error } = await supabase.from('notes').insert({
    id: uid(),
    user_id: userId,
    page_id: pageId,
    title: model.title.trim() || 'Untitled',
    content: model.content,
  });
  if (error) console.error('handleWriteNote failed:', error.message);
}
