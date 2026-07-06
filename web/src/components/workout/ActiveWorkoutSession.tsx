import { useEffect, useMemo, useRef, useState } from 'react';
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
  arrayMove,
  defaultAnimateLayoutChanges,
  useSortable,
  verticalListSortingStrategy,
  type AnimateLayoutChanges,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  MUSCLE_LABELS,
  type Exercise,
  type MuscleGroup,
  type SessionExercise,
  type SessionSet,
  type SetType,
  type WorkoutSummary,
} from '../../types/workout';
import { DEFAULT_REST_SECONDS, formatClock } from '../../lib/workout';
import { haptic } from '../../lib/native';
import type { UseWorkoutSession } from '../../hooks/workout/useWorkoutSession';
import ExerciseModal from './ExerciseModal';

interface Props {
  api: UseWorkoutSession;
  exercises: Exercise[];
  onCreateCustom: (name: string, groups: MuscleGroup[]) => Promise<Exercise | null>;
  onDeleteExercise: (id: string) => void;
  onFinished: (summary: WorkoutSummary) => void;
  /** Whether to show the RPE column in the set logger (Settings → Workout). */
  showRpe: boolean;
}

const SET_TYPE_NEXT: Record<SetType, SetType> = {
  normal: 'warmup',
  warmup: 'failure',
  failure: 'normal',
};

const badge =
  'rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300';
const numInput =
  'w-full rounded-md border border-gray-200 bg-white px-1.5 py-1 text-center text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

/** Grid column template for the set table — the RPE column drops out when the
 *  user has RPE display turned off. Shared by the header and every set row. */
function gridColsFor(showRpe: boolean): string {
  return showRpe
    ? 'grid-cols-[1.5rem_1fr_1fr_1fr_2.75rem_1.5rem]'
    : 'grid-cols-[1.5rem_1fr_1fr_2.75rem_1.5rem]';
}

/** An exercise is "complete" once it has sets and every set is checked off. */
function isExerciseComplete(ex: SessionExercise): boolean {
  return ex.sets.length > 0 && ex.sets.every((s) => s.done);
}

// Animate layout changes even when they're caused by a programmatic reorder
// (e.g. an exercise completing and sliding to the bottom), not just dragging.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });

function formatTimer(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function computeSummary(exercises: SessionExercise[], startedAt: string): WorkoutSummary {
  const muscles = new Set<MuscleGroup>();
  const exs = new Set<string>();
  let totalVolume = 0;
  let totalSets = 0;
  for (const ex of exercises) {
    let counted = false;
    for (const st of ex.sets) {
      if (st.weight_lbs == null && st.reps == null) continue;
      if (st.type === 'warmup') continue; // warm-ups excluded from working totals
      totalVolume += (st.weight_lbs ?? 0) * (st.reps ?? 0);
      totalSets += 1;
      counted = true;
    }
    if (counted) {
      exs.add(ex.exercise.id);
      ex.exercise.muscle_groups.forEach((m) => muscles.add(m));
    }
  }
  return {
    totalVolume,
    totalSets,
    exerciseCount: exs.size,
    durationMs: Date.now() - new Date(startedAt).getTime(),
    muscleGroups: Array.from(muscles),
  };
}

// --- a single editable set row --------------------------------------------

const TYPE_CELL: Record<SetType, string> = {
  normal: 'text-gray-400',
  warmup: 'text-amber-600 font-bold dark:text-amber-400',
  failure: 'text-red-600 font-bold dark:text-red-400',
};

function SetRow({
  index,
  set,
  gridCls,
  showRpe,
  onChange,
  onDelete,
  onCompleted,
}: {
  index: number;
  set: SessionSet;
  gridCls: string;
  showRpe: boolean;
  onChange: (patch: Partial<SessionSet>) => void;
  onDelete: () => void;
  onCompleted: () => void;
}) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);

  // The leading cell doubles as a set-type cycler: # → W (warm-up) → F (failure).
  const typeLabel = set.type === 'warmup' ? 'W' : set.type === 'failure' ? 'F' : index + 1;

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex w-16 items-center justify-center bg-red-500 text-xs font-medium text-white">
        Delete
      </div>
      <div
        className={`relative grid ${gridCls} items-center gap-1 bg-white py-1 dark:bg-gray-900`}
        style={{ transform: `translateX(${dx}px)`, transition: startX.current === null ? 'transform 0.15s' : 'none' }}
        onTouchStart={(e) => {
          startX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (startX.current === null) return;
          const delta = e.touches[0].clientX - startX.current;
          if (delta < 0) setDx(Math.max(delta, -80));
        }}
        onTouchEnd={() => {
          if (dx < -60) onDelete();
          setDx(0);
          startX.current = null;
        }}
      >
        <button
          type="button"
          onClick={() => onChange({ type: SET_TYPE_NEXT[set.type] })}
          aria-label={`Set type: ${set.type}. Tap to change.`}
          title="Tap to cycle: normal → warm-up → failure"
          className={`text-center text-xs ${TYPE_CELL[set.type]}`}
        >
          {typeLabel}
        </button>
        <input
          type="number"
          inputMode="decimal"
          value={set.weight_lbs ?? ''}
          onChange={(e) => onChange({ weight_lbs: num(e.target.value) })}
          className={numInput}
          aria-label={`Set ${index + 1} weight`}
        />
        <input
          type="number"
          inputMode="numeric"
          value={set.reps ?? ''}
          onChange={(e) => onChange({ reps: num(e.target.value) })}
          className={numInput}
          aria-label={`Set ${index + 1} reps`}
        />
        {showRpe && (
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={set.rpe ?? ''}
            onChange={(e) => onChange({ rpe: num(e.target.value) })}
            className={numInput}
            aria-label={`Set ${index + 1} RPE`}
          />
        )}
        {/* Completion checkbox — large tap target (44px) for mid-workout taps. */}
        <button
          type="button"
          onClick={() => {
            const next = !set.done;
            onChange({ done: next });
            if (next) {
              haptic();
              onCompleted(); // finishing a set starts the rest timer
            }
          }}
          aria-label="Mark set done"
          aria-pressed={set.done}
          className="grid h-11 w-11 place-items-center justify-self-center rounded-md"
        >
          <span
            className={`grid h-7 w-7 place-items-center rounded-md border text-sm ${
              set.done
                ? 'border-gray-800 bg-gray-800 text-white dark:border-gray-200 dark:bg-gray-200 dark:text-gray-900'
                : 'border-gray-300 text-transparent dark:border-gray-600'
            }`}
          >
            ✓
          </span>
        </button>
        {/* explicit delete (always visible; swipe-left also deletes on mobile) */}
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete set"
          className="grid h-11 w-6 place-items-center justify-self-center rounded-md text-gray-300 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
        >
          ×
        </button>
      </div>
    </div>
  );
}

// --- a sortable exercise block --------------------------------------------

function ExerciseBlock({
  ex,
  api,
  startRest,
  showRpe,
  completed,
}: {
  ex: SessionExercise;
  api: UseWorkoutSession;
  startRest: (seconds: number) => void;
  showRpe: boolean;
  completed: boolean;
}) {
  const restSeconds = ex.restSeconds ?? DEFAULT_REST_SECONDS;
  const gridCls = gridColsFor(showRpe);
  const [noteOpen, setNoteOpen] = useState(false);
  const exNotes = ex.notes ?? '';
  const showNote = noteOpen || exNotes.trim().length > 0;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: ex.key,
    animateLayoutChanges,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition-opacity duration-300 dark:border-gray-800 dark:bg-gray-900 ${
        completed && !isDragging ? 'opacity-40' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 truncate text-sm font-semibold">
            {completed && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-600 dark:text-green-400" aria-label="Completed">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            <span className="truncate">{ex.exercise.name}</span>
          </h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {ex.exercise.muscle_groups.map((m) => (
              <span key={m} className={badge}>
                {MUSCLE_LABELS[m]}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Reorder exercise"
            className="cursor-grab touch-none rounded-md p-1.5 text-gray-400 hover:bg-gray-100 active:cursor-grabbing dark:hover:bg-gray-800"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => api.removeExercise(ex.key)}
            aria-label="Remove exercise"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
          >
            ×
          </button>
        </div>
      </div>

      {/* per-exercise note — one note for the whole exercise, collapsed until used */}
      {showNote ? (
        <textarea
          value={exNotes}
          onChange={(e) => api.setExerciseNotes(ex.key, e.target.value)}
          placeholder="Notes for this exercise…"
          rows={2}
          autoFocus={noteOpen && !exNotes}
          className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
          aria-label={`Notes for ${ex.exercise.name}`}
        />
      ) : (
        <button
          type="button"
          onClick={() => setNoteOpen(true)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add note
        </button>
      )}

      {/* per-exercise rest (used by the rest timer; editable here or in templates) */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2M9 2h6" strokeLinecap="round" />
        </svg>
        Rest
        <input
          type="number"
          inputMode="numeric"
          value={ex.restSeconds ?? ''}
          placeholder={String(DEFAULT_REST_SECONDS)}
          onChange={(e) => api.setExerciseRest(ex.key, num(e.target.value))}
          className="w-14 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-center text-xs outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
          aria-label="Rest seconds"
        />
        s between sets
      </div>

      {/* column headers */}
      <div className={`mt-3 grid ${gridCls} gap-1 px-0 text-[10px] font-medium uppercase tracking-wide text-gray-400`}>
        <span className="text-center">#</span>
        <span className="text-center">lbs</span>
        <span className="text-center">reps</span>
        {showRpe && <span className="text-center">rpe</span>}
        <span className="text-center">✓</span>
        <span />
      </div>

      <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
        {ex.sets.map((st, i) => (
          <SetRow
            key={st.id}
            index={i}
            set={st}
            gridCls={gridCls}
            showRpe={showRpe}
            onChange={(patch) => api.updateSet(ex.key, st.id, patch)}
            onDelete={() => api.deleteSet(ex.key, st.id)}
            onCompleted={() => startRest(st.rest ?? restSeconds)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => api.addSet(ex.key)}
        className="mt-2 w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        + Add set
      </button>
    </div>
  );
}

// --- the session screen ----------------------------------------------------

export default function ActiveWorkoutSession({
  api,
  exercises,
  onCreateCustom,
  onDeleteExercise,
  onFinished,
  showRpe,
}: Props) {
  const session = api.session!;
  const [now, setNow] = useState(Date.now());
  const [modalOpen, setModalOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<WorkoutSummary | null>(null);
  const [saving, setSaving] = useState(false);
  // Rest timer between sets — starts when a set is checked off.
  const [rest, setRest] = useState<{ endsAt: number } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Auto-clear the rest timer when it reaches zero.
  useEffect(() => {
    if (rest && now >= rest.endsAt) setRest(null);
  }, [now, rest]);

  const startRest = (seconds: number) => setRest({ endsAt: Date.now() + seconds * 1000 });
  const adjustRest = (delta: number) =>
    setRest((r) => (r ? { endsAt: Math.max(Date.now(), r.endsAt + delta * 1000) } : r));
  const restRemaining = rest ? Math.max(0, Math.round((rest.endsAt - now) / 1000)) : 0;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const preview = useMemo(
    () => computeSummary(session.exercises, session.startedAt),
    // recompute as sets change
    [session.exercises, session.startedAt]
  );

  // Display order: incomplete exercises first (in their user-defined order),
  // completed ones sink to the bottom. This is a *view* — the session's stored
  // order is untouched (Fix 7).
  const displayExercises = useMemo(() => {
    const incomplete: SessionExercise[] = [];
    const complete: SessionExercise[] = [];
    for (const ex of session.exercises) {
      (isExerciseComplete(ex) ? complete : incomplete).push(ex);
    }
    return [...incomplete, ...complete];
  }, [session.exercises]);

  const allComplete =
    session.exercises.length > 0 && session.exercises.every(isExerciseComplete);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = displayExercises.findIndex((x) => x.key === active.id);
    const newIndex = displayExercises.findIndex((x) => x.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    api.reorderExercises(arrayMove(displayExercises, oldIndex, newIndex));
  }

  async function confirmFinish() {
    if (saving) return;
    setSaving(true);
    const summary = await api.finish(notes);
    setSaving(false);
    if (summary) setSaved(summary);
  }

  function handleDiscard() {
    if (window.confirm('Discard this workout? Nothing will be saved.')) api.discard();
  }

  const elapsed = now - new Date(session.startedAt).getTime();

  // --- saved summary card --------------------------------------------------
  if (saved) {
    return (
      <div className="mx-auto max-w-app p-4">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gray-800 text-white">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 12.5l3.2 3.2L17 9" />
            </svg>
          </div>
          <h2 className="text-lg font-bold">Workout complete</h2>
          <p className="mt-1 text-sm text-gray-500">{session.name}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <Stat label="Total volume" value={`${Math.round(saved.totalVolume).toLocaleString()} lbs`} />
            <Stat label="Duration" value={formatTimer(saved.durationMs)} />
            <Stat label="Exercises" value={String(saved.exerciseCount)} />
            <Stat label="Sets" value={String(saved.totalSets)} />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {saved.muscleGroups.map((m) => (
              <span key={m} className={badge}>
                {MUSCLE_LABELS[m]}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onFinished(saved)}
            className="mt-5 w-full rounded-xl bg-gray-800 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-fab mx-auto max-w-app p-4 pb-28">
      {/* header */}
      <div className="sticky top-0 z-10 -mx-4 mb-3 flex items-center justify-between border-b border-gray-200 bg-gray-50/90 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
        <div>
          <h1 className="text-base font-bold">{session.name}</h1>
          <p className="text-xs text-gray-500">{preview.totalSets} sets logged</p>
        </div>
        <div className="font-mono text-lg tabular-nums">{formatTimer(elapsed)}</div>
      </div>

      {/* all-done banner */}
      {allComplete && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-500/30 dark:bg-green-500/10">
          <span className="text-2xl">🎉</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">Workout complete!</p>
            <p className="text-xs text-green-700/80 dark:text-green-400/80">Every exercise is done. Ready to log it?</p>
          </div>
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="shrink-0 rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Finish
          </button>
        </div>
      )}

      {/* exercises */}
      {session.exercises.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-sm text-gray-400">No exercises yet — add your first one.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={displayExercises.map((x) => x.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {displayExercises.map((ex) => (
                <ExerciseBlock
                  key={ex.key}
                  ex={ex}
                  api={api}
                  startRest={startRest}
                  showRpe={showRpe}
                  completed={isExerciseComplete(ex)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="mt-3 w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        + Add exercise
      </button>

      {session.exercises.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-gray-400">
          Tap a set number to cycle <span className="font-semibold text-amber-600 dark:text-amber-400">W</span>arm-up /{' '}
          <span className="font-semibold text-red-600 dark:text-red-400">F</span>ailure · check ✓ to start the rest timer
        </p>
      )}

      {/* footer actions */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 p-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
        <div className="mx-auto max-w-app">
          {rest && (
            <div className="mb-2 flex items-center gap-2 rounded-xl bg-gray-800 px-3 py-2 text-white dark:bg-gray-200 dark:text-gray-900">
              <span className="text-xs font-medium uppercase tracking-wide opacity-70">Rest</span>
              <span className="font-mono text-lg tabular-nums">{formatClock(restRemaining)}</span>
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustRest(-15)}
                  className="rounded-md bg-white/20 px-2 py-1 text-xs font-medium dark:bg-black/10"
                >
                  −15s
                </button>
                <button
                  type="button"
                  onClick={() => adjustRest(15)}
                  className="rounded-md bg-white/20 px-2 py-1 text-xs font-medium dark:bg-black/10"
                >
                  +15s
                </button>
                <button
                  type="button"
                  onClick={() => setRest(null)}
                  className="rounded-md bg-white/20 px-2 py-1 text-xs font-medium dark:bg-black/10"
                >
                  Skip
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setReviewing(true)}
              className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700"
            >
              Finish workout
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <ExerciseModal
          exercises={exercises}
          onPick={(e) => {
            api.addExercise(e);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
          onCreateCustom={onCreateCustom}
          onDeleteExercise={onDeleteExercise}
        />
      )}

      {/* finish review */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => !saving && setReviewing(false)}>
          <div
            className="w-full max-w-app rounded-t-3xl bg-white p-5 shadow-xl animate-slide-up dark:bg-gray-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">Finish workout</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat label="Total volume" value={`${Math.round(preview.totalVolume).toLocaleString()} lbs`} />
              <Stat label="Duration" value={formatTimer(elapsed)} />
              <Stat label="Exercises" value={String(preview.exerciseCount)} />
              <Stat label="Sets" value={String(preview.totalSets)} />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes (optional)…"
              rows={2}
              className="mt-3 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                disabled={saving}
                className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium dark:border-gray-700"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={confirmFinish}
                disabled={saving}
                className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save workout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2 dark:bg-gray-800/60">
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
