// Execution handlers for the voice assistant. Each takes the already-reviewed
// data (the user confirmed it) and performs the write. All Supabase writes go
// through the existing authed client. Errors are logged and collected, never
// thrown, so one failing section doesn't abort the rest.

import { supabase } from './supabase';
import { todayISO } from './dates';
import { setPendingWorkout } from './workoutHandoff';
import type {
  HabitReviewModel,
  ReminderReviewModel,
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

// 4. Reminders (reuse existing Supabase reminders system) ------------------
export async function handleSetReminder(
  model: ReminderReviewModel,
  userId: string
): Promise<void> {
  // Default to one hour out if no time was given (the card lets the user edit).
  const remindAt = model.datetime
    ? new Date(model.datetime)
    : new Date(Date.now() + 60 * 60 * 1000);
  const { error } = await supabase.from('reminders').insert({
    id: uid(),
    user_id: userId,
    title: model.text,
    remind_at: remindAt.toISOString(),
    repeat: model.recurring ?? 'none',
  });
  if (error) console.error('handleSetReminder failed:', error.message);
}
