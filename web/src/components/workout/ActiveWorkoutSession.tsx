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

/** Hard cap on a session. Past this the workout is ended and saved on its own —
 *  a forgotten session would otherwise log a 14-hour "workout". */
export const MAX_SESSION_MS = 2.5 * 60 * 60 * 1000;
/** How long before the cap the countdown warning appears. */
const WARN_MS = 15 * 60 * 1000;
/** How long the "rest done" flash stays up after a timer runs out. */
const REST_DONE_MS = 6000;

interface Props {
  api: UseWorkoutSession;
  exercises: Exercise[];
  onCreateCustom: (name: string, groups: MuscleGroup[]) => Promise<Exercise | null>;
  onDeleteExercise: (id: string) => void;
  /** Hands the saved session up so the summary screen can outlive this one. */
  onFinished: (
    summary: WorkoutSummary,
    snapshot: { name: string; exercises: SessionExercise[] },
    auto: boolean
  ) => void;
  /** Whether to show the RPE column in the set logger (Settings → Workout). */
  showRpe: boolean;
}

const SET_TYPE_NEXT: Record<SetType, SetType> = {
  normal: 'warmup',
  warmup: 'failure',
  failure: 'normal',
};

const badge =
  'rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300';
const numInput =
  'w-full rounded-xl border border-gray-200 bg-white px-1.5 py-2 text-center text-base font-semibold tabular-nums outline-none focus:border-accent-500 dark:border-gray-700 dark:bg-gray-950';

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

/** Does this session have anything worth saving? */
function hasLoggedWork(exercises: SessionExercise[]): boolean {
  return exercises.some((e) => e.sets.some((s) => s.weight_lbs != null || s.reps != null));
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
    <div className="relative overflow-hidden rounded-xl">
      <div className="absolute inset-y-0 right-0 flex w-16 items-center justify-center bg-red-500 text-xs font-medium text-white">
        Delete
      </div>
      <div
        // Owns its own horizontal gesture (swipe left to delete), so the
        // app-level swipe navigation must keep its hands off this row.
        data-no-swipe
        className={`relative grid ${gridCls} items-center gap-1.5 py-1 transition-colors ${
          set.done ? 'bg-accent-50/70 dark:bg-accent-500/10' : 'bg-white dark:bg-gray-900'
        }`}
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
          className={`text-center text-sm font-semibold ${TYPE_CELL[set.type]}`}
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
          className="grid h-11 w-11 place-items-center justify-self-center rounded-xl"
        >
          <span
            className={`grid h-8 w-8 place-items-center rounded-xl border text-sm transition-all ${
              set.done
                ? 'border-transparent bg-gradient-to-b from-accent-500 to-accent-600 text-white shadow-glow'
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
  current,
}: {
  ex: SessionExercise;
  api: UseWorkoutSession;
  startRest: (seconds: number) => void;
  showRpe: boolean;
  completed: boolean;
  /** The exercise you're on right now — the one the screen is built around. */
  current: boolean;
}) {
  const restSeconds = ex.restSeconds ?? DEFAULT_REST_SECONDS;
  const gridCls = gridColsFor(showRpe);
  const [noteOpen, setNoteOpen] = useState(false);
  // null = follow the current exercise; true/false = the user chose.
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? current;
  const exNotes = ex.notes ?? '';
  const showNote = noteOpen || exNotes.trim().length > 0;

  const doneSets = ex.sets.filter((s) => s.done).length;
  const topSet = ex.sets.reduce<SessionSet | null>((best, s) => {
    if (s.weight_lbs == null) return best;
    return !best || (best.weight_lbs ?? 0) < s.weight_lbs ? s : best;
  }, null);

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
      className={[
        'rounded-2xl border bg-white transition-all duration-300 dark:bg-gray-900',
        current
          ? 'border-accent-400/60 shadow-glow ring-1 ring-accent-400/40'
          : 'border-gray-200 shadow-card dark:border-gray-800',
        completed && !open && !isDragging ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Title row — doubles as the collapse toggle. */}
      <div className={`flex items-start gap-2 ${open ? 'p-3.5 pb-2' : 'p-3'}`}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Reorder exercise"
          className="-ml-1 grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-gray-300 hover:text-gray-500 active:cursor-grabbing dark:text-gray-600"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setOpenOverride(!open)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <span className="flex flex-wrap items-center gap-1.5">
            {completed && (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-green-600 dark:text-green-400" aria-label="Completed">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            )}
            <span className={`min-w-0 break-words font-semibold ${current ? 'text-[17px]' : 'text-sm'}`}>
              {ex.exercise.name}
            </span>
            {current && (
              <span className="shrink-0 rounded-full bg-gradient-to-b from-accent-500 to-accent-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                Now
              </span>
            )}
          </span>

          {open ? (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {ex.exercise.muscle_groups.map((m) => (
                <span key={m} className={badge}>
                  {MUSCLE_LABELS[m]}
                </span>
              ))}
            </span>
          ) : (
            <span className="mt-0.5 block text-xs text-gray-500">
              {doneSets}/{ex.sets.length} sets
              {topSet?.weight_lbs != null && ` · top ${topSet.weight_lbs}×${topSet.reps ?? '—'}`}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center">
          {open && (
            <button
              type="button"
              onClick={() => api.removeExercise(ex.key)}
              aria-label="Remove exercise"
              className="grid h-9 w-9 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
            >
              ×
            </button>
          )}
          <button
            type="button"
            onClick={() => setOpenOverride(!open)}
            aria-label={open ? 'Collapse exercise' : 'Expand exercise'}
            className="grid h-9 w-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg
              width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <div className="px-3.5 pb-3.5">
          {/* per-exercise note — one note for the whole exercise, collapsed until used */}
          {showNote ? (
            <textarea
              value={exNotes}
              onChange={(e) => api.setExerciseNotes(ex.key, e.target.value)}
              placeholder="Notes for this exercise…"
              rows={2}
              autoFocus={noteOpen && !exNotes}
              className="w-full resize-y rounded-xl border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-accent-500 dark:border-gray-700 dark:bg-gray-950"
              aria-label={`Notes for ${ex.exercise.name}`}
            />
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add note
            </button>
          )}

          {/* per-exercise rest (feeds the rest timer; editable here or in templates) */}
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
              className="w-14 rounded-lg border border-gray-200 bg-white px-1.5 py-0.5 text-center text-xs outline-none focus:border-accent-500 dark:border-gray-700 dark:bg-gray-950"
              aria-label="Rest seconds"
            />
            s between sets
          </div>

          {/* column headers */}
          <div className={`mt-3 grid ${gridCls} gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400`}>
            <span className="text-center">#</span>
            <span className="text-center">lbs</span>
            <span className="text-center">reps</span>
            {showRpe && <span className="text-center">rpe</span>}
            <span className="text-center">✓</span>
            <span />
          </div>

          <div className="mt-1 space-y-1">
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
            className="mt-2 w-full rounded-xl border border-dashed border-gray-300 py-2 text-xs font-semibold text-gray-500 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
          >
            + Add set
          </button>
        </div>
      )}
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
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(session.name);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  // Rest timer between sets — starts when a set is checked off. `total` drives
  // the progress bar; `doneAt` keeps the "rest over" flash on screen briefly.
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [restDoneAt, setRestDoneAt] = useState<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Rest reaching zero: buzz once, then show the "rest over" card for a moment.
  useEffect(() => {
    if (rest && now >= rest.endsAt) {
      setRest(null);
      setRestDoneAt(Date.now());
      haptic();
    }
  }, [now, rest]);

  const startRest = (seconds: number) => {
    setRestDoneAt(null);
    setRest({ endsAt: Date.now() + seconds * 1000, total: Math.max(1, seconds) });
  };
  const adjustRest = (delta: number) =>
    setRest((r) =>
      r
        ? {
            endsAt: Math.max(Date.now(), r.endsAt + delta * 1000),
            total: Math.max(1, r.total + delta),
          }
        : r
    );
  const restRemaining = rest ? Math.max(0, Math.round((rest.endsAt - now) / 1000)) : 0;
  const restPct = rest ? Math.max(0, Math.min(100, (restRemaining / rest.total) * 100)) : 0;
  const restJustDone = restDoneAt != null && now - restDoneAt < REST_DONE_MS;

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

  // The exercise you're on: the first one that still has unchecked sets.
  const currentKey = displayExercises.find((x) => !isExerciseComplete(x))?.key ?? null;
  const doneCount = session.exercises.filter(isExerciseComplete).length;
  const allComplete = session.exercises.length > 0 && doneCount === session.exercises.length;

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = displayExercises.findIndex((x) => x.key === active.id);
    const newIndex = displayExercises.findIndex((x) => x.key === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    api.reorderExercises(arrayMove(displayExercises, oldIndex, newIndex));
  }

  const savingRef = useRef(false);

  /** Write the session to the log. `auto` marks the 2h30m cap ending it. */
  async function endSession(auto: boolean) {
    if (savingRef.current) return;
    const snapshot = { name: session.name, exercises: session.exercises };
    // An abandoned session with nothing logged isn't worth a row in History.
    if (auto && !hasLoggedWork(session.exercises)) {
      api.discard();
      return;
    }
    savingRef.current = true;
    setSaving(true);
    const note = auto
      ? [notes.trim(), 'Auto-ended after 2h30m.'].filter(Boolean).join('\n')
      : notes;
    // Stamp an auto-end at the cap itself, so a session that sat open while the
    // app was closed still logs as 2h30m rather than the wall-clock gap.
    const cappedAt = new Date(
      new Date(session.startedAt).getTime() + MAX_SESSION_MS
    ).toISOString();
    const summary = await api.finish(note, auto ? cappedAt : undefined);
    savingRef.current = false;
    setSaving(false);
    if (summary) onFinished(summary, snapshot, auto);
  }

  function commitRename() {
    setRenaming(false);
    api.rename(nameDraft);
  }

  function handleDiscard() {
    if (window.confirm('Discard this workout? Nothing will be saved.')) api.discard();
  }

  const elapsed = now - new Date(session.startedAt).getTime();
  const remainingToCap = MAX_SESSION_MS - elapsed;

  // The 2h30m cap. Also covers a session resumed from localStorage that already
  // ran past the limit while the app was closed — the first tick catches it.
  useEffect(() => {
    if (elapsed < MAX_SESSION_MS) return;
    void endSession(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed]);

  return (
    <div className="pb-session mx-auto max-w-app p-4">
      {/* header */}
      <div className="glass sticky top-0 z-10 -mx-4 mb-4 border-b px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {renaming ? (
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') {
                    setNameDraft(session.name);
                    setRenaming(false);
                  }
                }}
                autoFocus
                aria-label="Workout name"
                className="w-full rounded-xl border border-gray-300 bg-white px-2 py-1 text-lg font-bold outline-none focus:border-accent-500 dark:border-gray-600 dark:bg-gray-900"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNameDraft(session.name);
                  setRenaming(true);
                }}
                title="Tap to rename this workout"
                className="flex w-full items-center gap-1.5 text-left"
              >
                <h1 className="truncate text-lg font-bold tracking-tight">{session.name}</h1>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-gray-400">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </button>
            )}
            <p className="mt-0.5 text-xs text-gray-500">
              {preview.totalSets} sets · {Math.round(preview.totalVolume).toLocaleString()} lbs
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="font-mono text-2xl font-bold leading-none tabular-nums">
              {formatTimer(elapsed)}
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
              {doneCount}/{session.exercises.length} done
            </div>
          </div>
        </div>

        {/* progress through the exercises */}
        {session.exercises.length > 0 && (
          <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent-400 to-accent-600 transition-[width] duration-500"
              style={{ width: `${(doneCount / session.exercises.length) * 100}%` }}
            />
          </div>
        )}

        {/* heads-up before the 2h30m cap ends the session */}
        {remainingToCap < WARN_MS && remainingToCap > 0 && (
          <p className="mt-2 rounded-xl bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            Auto-finishing in {formatClock(Math.round(remainingToCap / 1000))} — sessions cap at 2h30m.
          </p>
        )}
      </div>

      {/* all-done banner */}
      {allComplete && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-500/30 dark:bg-green-500/10">
          <span className="text-2xl">🎉</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">Every exercise done</p>
            <p className="text-xs text-green-700/80 dark:text-green-400/80">Ready to log it?</p>
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
            <div className="space-y-2.5">
              {displayExercises.map((ex) => (
                <ExerciseBlock
                  key={ex.key}
                  ex={ex}
                  api={api}
                  startRest={startRest}
                  showRpe={showRpe}
                  completed={isExerciseComplete(ex)}
                  current={ex.key === currentKey}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="mt-3 w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 shadow-card transition-colors hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        + Add exercise
      </button>

      {session.exercises.length > 0 && (
        <p className="mt-2 text-center text-[11px] text-gray-400">
          Tap a set number to cycle <span className="font-semibold text-amber-600 dark:text-amber-400">W</span>arm-up /{' '}
          <span className="font-semibold text-red-600 dark:text-red-400">F</span>ailure · check ✓ to start the rest timer
        </p>
      )}

      {/* Floating action bar — same glass pill language as the mobile dock, with
          the rest timer riding directly above it so it's impossible to miss. */}
      <div className="above-dock fixed inset-x-0 bottom-0 z-20 px-3 pb-3 pt-2 sm:pb-4">
        <div className="mx-auto max-w-app space-y-2">
          {(rest || restJustDone) && (
            <div
              className={[
                'animate-pop-in overflow-hidden rounded-[1.4rem] px-4 py-3 text-white shadow-pop',
                rest
                  ? 'bg-gradient-to-br from-accent-500 to-accent-700'
                  : 'bg-gradient-to-br from-green-500 to-green-700',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/75">
                    {rest ? 'Rest' : 'Rest over'}
                  </p>
                  <p className="font-mono text-4xl font-bold leading-none tabular-nums">
                    {rest ? formatClock(restRemaining) : 'Go'}
                  </p>
                </div>
                {rest ? (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustRest(-15)}
                      className="h-9 rounded-xl bg-white/20 px-2.5 text-xs font-bold transition-colors hover:bg-white/30"
                    >
                      −15s
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustRest(15)}
                      className="h-9 rounded-xl bg-white/20 px-2.5 text-xs font-bold transition-colors hover:bg-white/30"
                    >
                      +15s
                    </button>
                    <button
                      type="button"
                      onClick={() => setRest(null)}
                      className="h-9 rounded-xl bg-white/20 px-2.5 text-xs font-bold transition-colors hover:bg-white/30"
                    >
                      Skip
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRestDoneAt(null)}
                    className="h-9 shrink-0 rounded-xl bg-white/20 px-3 text-xs font-bold transition-colors hover:bg-white/30"
                  >
                    Dismiss
                  </button>
                )}
              </div>
              {rest && (
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/20">
                  <div
                    className="h-full rounded-full bg-white/90 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${restPct}%` }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="glass flex items-center gap-2 rounded-[1.4rem] border p-1.5 shadow-pop">
            <button
              type="button"
              onClick={handleDiscard}
              className="grid h-11 shrink-0 place-items-center rounded-2xl px-4 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-100 hover:text-red-600 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => setReviewing(true)}
              className="btn-accent h-11 min-w-0 flex-1 rounded-2xl px-4 text-sm font-semibold"
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
        <div
          data-no-swipe
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => !saving && setReviewing(false)}
        >
          <div
            className="w-full max-w-app rounded-t-3xl bg-white p-5 shadow-xl animate-slide-up dark:bg-gray-900 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold">Finish workout</h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <ReviewStat label="Volume" value={`${Math.round(preview.totalVolume).toLocaleString()} lbs`} />
              <ReviewStat label="Duration" value={formatTimer(elapsed)} />
              <ReviewStat label="Exercises" value={String(preview.exerciseCount)} />
              <ReviewStat label="Sets" value={String(preview.totalSets)} />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Session notes (optional)…"
              rows={2}
              className="mt-3 w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-500 dark:border-gray-700 dark:bg-gray-950"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                disabled={saving}
                className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold dark:border-gray-700"
              >
                Keep going
              </button>
              <button
                type="button"
                onClick={() => endSession(false)}
                disabled={saving}
                className="btn-accent flex-1 px-4 py-3 text-sm font-semibold disabled:opacity-60"
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

function ReviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
