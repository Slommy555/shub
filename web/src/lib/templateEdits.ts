// Detecting — and saving back — the edits a user makes to a template while
// running it as a workout.
//
// "Save to Template" overwrites the source template with the session exactly as
// it was performed: its exercises, their order, the sets logged, and the reps
// AND weights of those sets. Carrying the weights back is the point — it's what
// makes progressive overload stick from one week to the next. A set the user
// never filled in has nothing to carry, so it keeps the weight the plan already
// had rather than wiping it to blank.

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

/** Same collapse as `describeReps`, for weights. */
function describeWeights(weights: (number | null)[]): string {
  if (weights.length === 0) return '—';
  const shown = weights.map((w) => (w == null ? '—' : String(w)));
  return shown.every((w) => w === shown[0]) ? shown[0] : shown.join('/');
}

/**
 * The weight to write back for one set: what was actually logged, which is how
 * progressive overload carries forward. Two cases keep the plan's own number
 * instead:
 *   - the row was never filled in, so there's nothing to carry;
 *   - a deload week pre-filled every set at a reduced weight and the user just
 *     lifted it. That's the deload doing its job, not a lighter plan — writing
 *     it back would ratchet the template DOWN every deload.
 * A set added past the end of the plan inherits the last planned weight.
 */
function savedWeight(
  logged: number | null,
  base: TemplateBaseline['exercises'][number] | undefined,
  index: number
): number | null {
  const planned = base
    ? base.weights[index] ?? base.weights[base.weights.length - 1] ?? null
    : null;
  if (logged == null) return planned;
  if (base?.prefillWeight != null && logged === base.prefillWeight) return planned;
  return logged;
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
    // Weights carry back now, so a change in them is a real edit to report.
    const wBefore = describeWeights(b.weights);
    const wAfter = describeWeights(ex.sets.map((s, j) => savedWeight(s.weight_lbs, b, j)));
    if (wBefore !== wAfter) parts.push(`${wBefore} lbs → ${wAfter} lbs`);
    // Pairing is template data too — only whether it's paired, not with which
    // generated uuid, so re-pairing the same two exercises reports nothing.
    const wasPaired = Boolean(b.superset_group_id);
    const isPaired = Boolean(ex.supersetGroupId);
    if (wasPaired !== isPaired) parts.push(isPaired ? 'added to a superset' : 'superset removed');
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
 * Rebuild the template's exercise rows from the session exactly as performed:
 * its exercises in their current order, the sets it ended with, and each set's
 * reps, weight, type and superset pairing. Every row is rewritten, so exercises
 * added, removed and reordered all land — the caller replaces the template's
 * whole exercise list with what comes back.
 *
 * `default_sets` / `default_reps` / `default_weight` are the legacy single-value
 * columns, kept in sync off the first set so templates written before the
 * per-set plan still read correctly.
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
      weight: savedWeight(s.weight_lbs, b, j),
      type: s.type,
      rest: s.rest ?? (b ? b.restPerSet[j] ?? null : null),
    }));
    // The legacy default_* trio reads off the first set, falling back to the
    // first set that has a value so a blank opening row doesn't blank the plan.
    const firstReps = sets.find((s) => s.reps != null)?.reps ?? sets[0]?.reps ?? null;
    const firstWeight = sets.find((s) => s.weight != null)?.weight ?? sets[0]?.weight ?? null;
    return {
      exercise_id: ex.exercise.id,
      position: i,
      default_sets: sets.length,
      default_reps: sets[0]?.reps ?? firstReps,
      default_weight: sets[0]?.weight ?? firstWeight,
      rest_seconds: ex.restSeconds,
      superset_group_id: ex.supersetGroupId ?? null,
      sets,
    };
  });
}
