// Detecting — and saving back — the structural edits a user makes to a template
// while running it as a workout.
//
// "Structural" is the whole point of this file: exercises, set counts, planned
// reps and order are TEMPLATE data and can be written back. The weights logged
// per set are WORKOUT data and never are — `templateItemsFromEdited` rebuilds
// each row's weights from the baseline snapshot, not from what was lifted.

import type {
  SessionExercise,
  TemplateBaseline,
  TemplateEdit,
  TemplateSet,
} from '../types/workout';
import type { TemplateItemInput } from '../hooks/workout/useTemplates';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * The rep scheme as one label: a single number when every set matches (the
 * common case, and what a template's `default_reps` means), otherwise the
 * per-set list so "4×10" and "10/10/8/6" don't read the same.
 */
function describeReps(reps: (number | null)[]): string {
  if (reps.length === 0) return '—';
  const shown = reps.map((r) => (r == null ? '—' : String(r)));
  return shown.every((r) => r === shown[0]) ? shown[0] : shown.join('/');
}

/**
 * Compare the live session against the template it was started from. Derived
 * rather than appended to as the user edits, so an add-then-remove or a reps
 * value typed and retyped nets out to nothing instead of stacking up lines.
 */
export function diffTemplateEdits(
  baseline: TemplateBaseline,
  exercises: SessionExercise[]
): TemplateEdit[] {
  const base = new Map(baseline.exercises.map((b) => [b.key, b]));
  const live = new Map(exercises.map((e) => [e.key, e]));
  const edits: TemplateEdit[] = [];

  // 1. Added — in the session but not in the template.
  for (const ex of exercises) {
    if (!base.has(ex.key)) edits.push({ kind: 'added', name: ex.exercise.name });
  }

  // 2. Removed — in the template but dropped from the session.
  for (const b of baseline.exercises) {
    if (!live.has(b.key)) edits.push({ kind: 'removed', name: b.name });
  }

  // 3. Changed — set count and/or rep scheme, on exercises present in both.
  for (const ex of exercises) {
    const b = base.get(ex.key);
    if (!b) continue;
    const parts: string[] = [];
    if (b.reps.length !== ex.sets.length) {
      parts.push(`${plural(b.reps.length, 'set')} → ${plural(ex.sets.length, 'set')}`);
    }
    const before = describeReps(b.reps);
    const after = describeReps(ex.sets.map((s) => s.reps));
    if (before !== after) parts.push(`${before} reps → ${after} reps`);
    if (parts.length) {
      edits.push({ kind: 'changed', name: ex.exercise.name, detail: parts.join(', ') });
    }
  }

  // 4. Reordered — the exercises common to both, in each one's own order. Adds
  //    and removals shift positions on their own, so they're excluded here or
  //    every add would also report as a reorder.
  const liveOrder = exercises.filter((e) => base.has(e.key)).map((e) => e.key);
  const baseOrder = baseline.exercises.filter((b) => live.has(b.key)).map((b) => b.key);
  if (liveOrder.join('|') !== baseOrder.join('|')) {
    edits.push({ kind: 'reordered', name: '' });
  }

  return edits;
}

/**
 * Rebuild the template's exercise rows from the edited session: current order,
 * current exercises, current set counts and reps — and the *planned* weights
 * carried over from the baseline. A set added past the end of the plan inherits
 * the last planned weight; a newly added exercise has no plan, so its weights
 * start empty rather than borrowing today's numbers.
 */
export function templateItemsFromEdited(
  baseline: TemplateBaseline,
  exercises: SessionExercise[]
): TemplateItemInput[] {
  const base = new Map(baseline.exercises.map((b) => [b.key, b]));
  return exercises.map((ex, i) => {
    const b = base.get(ex.key);
    const sets: TemplateSet[] = ex.sets.map((s, j) => ({
      reps: s.reps,
      weight: b ? b.weights[j] ?? b.weights[b.weights.length - 1] ?? null : null,
      type: s.type,
      rest: s.rest ?? (b ? b.restPerSet[j] ?? null : null),
    }));
    return {
      exercise_id: ex.exercise.id,
      position: i,
      default_sets: sets.length,
      default_reps: sets[0]?.reps ?? null,
      default_weight: sets[0]?.weight ?? null,
      rest_seconds: ex.restSeconds,
      sets,
    };
  });
}
