import { useState } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  MUSCLE_LABELS,
  type Exercise,
  type MuscleGroup,
  type SetType,
} from '../../types/workout';
import type { UseTemplates } from '../../hooks/workout/useTemplates';
import { DEFAULT_REST_SECONDS, formatDate } from '../../lib/workout';
import ExerciseModal from './ExerciseModal';

interface Props {
  templatesApi: UseTemplates;
  exercises: Exercise[];
  createCustom: (name: string, groups: MuscleGroup[]) => Promise<Exercise | null>;
  deleteExercise: (id: string) => void;
}

/** A single planned set inside the editor. */
interface EditorSet {
  id: string;
  type: SetType;
  reps: number | null;
  weight: number | null;
  rest: number | null;
}

interface EditorItem {
  key: string;
  exercise: Exercise;
  restSeconds: number | null;
  sets: EditorSet[];
}

const SET_TYPE_NEXT: Record<SetType, SetType> = {
  normal: 'warmup',
  warmup: 'failure',
  failure: 'normal',
};

const TYPE_CELL: Record<SetType, string> = {
  normal: 'text-gray-400',
  warmup: 'text-amber-600 font-bold dark:text-amber-400',
  failure: 'text-red-600 font-bold dark:text-red-400',
};

const SET_GRID = 'grid grid-cols-[1.5rem_1fr_1fr_1.4fr_1.4rem_1.4rem] items-center gap-1';

const numInput =
  'w-full rounded-md border border-gray-200 bg-white px-1.5 py-1 text-center text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function newSet(prev?: EditorSet): EditorSet {
  return {
    id: crypto.randomUUID(),
    type: 'normal',
    reps: prev?.reps ?? 10,
    weight: prev?.weight ?? null,
    rest: prev?.rest ?? null,
  };
}

export default function TemplatesTab({
  templatesApi,
  exercises,
  createCustom,
  deleteExercise,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleNew() {
    const t = await templatesApi.createTemplate('New Template');
    if (t) setEditingId(t.id);
  }

  if (editingId) {
    return (
      <TemplateEditor
        key={editingId}
        templateId={editingId}
        templatesApi={templatesApi}
        exercises={exercises}
        createCustom={createCustom}
        deleteExercise={deleteExercise}
        onClose={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-app space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Templates</h1>
        <button
          type="button"
          onClick={handleNew}
          className="rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700"
        >
          + New
        </button>
      </div>

      {templatesApi.loading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : templatesApi.templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-sm text-gray-400">
            No templates yet — create one to pre-load your favorite workouts.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {templatesApi.templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <button
                type="button"
                onClick={() => setEditingId(t.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-semibold">{t.name}</span>
                <span className="block text-xs text-gray-500">
                  {t.exercise_count} exercise{t.exercise_count === 1 ? '' : 's'} ·{' '}
                  {t.last_used_at ? `last used ${formatDate(t.last_used_at)}` : 'never used'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Delete "${t.name}"?`)) templatesApi.deleteTemplate(t.id);
                }}
                aria-label="Delete template"
                className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- editor ----------------------------------------------------------------

function TemplateEditor({
  templateId,
  templatesApi,
  exercises,
  createCustom,
  deleteExercise,
  onClose,
}: {
  templateId: string;
  templatesApi: UseTemplates;
  exercises: Exercise[];
  createCustom: (name: string, groups: MuscleGroup[]) => Promise<Exercise | null>;
  deleteExercise: (id: string) => void;
  onClose: () => void;
}) {
  const template = templatesApi.templates.find((t) => t.id === templateId);

  const [name, setName] = useState(template?.name ?? '');
  const [notes, setNotes] = useState(template?.notes ?? '');
  const [items, setItems] = useState<EditorItem[]>(() =>
    template?.exercises.map((te) => {
      // Prefer the explicit per-set plan; fall back to legacy default_* counts.
      const planned: EditorSet[] =
        te.sets && te.sets.length > 0
          ? te.sets.map((s) => ({
              id: crypto.randomUUID(),
              type: s.type ?? 'normal',
              reps: s.reps ?? null,
              weight: s.weight ?? null,
              rest: s.rest ?? null,
            }))
          : Array.from({ length: Math.max(1, te.default_sets ?? 1) }, () => ({
              id: crypto.randomUUID(),
              type: 'normal' as SetType,
              reps: te.default_reps ?? null,
              weight: te.default_weight ?? null,
              rest: null,
            }));
      return {
        key: crypto.randomUUID(),
        exercise: te.exercise,
        restSeconds: te.rest_seconds,
        sets: planned,
      };
    }) ?? []
  );
  const [modalOpen, setModalOpen] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((x) => x.key === active.id);
      const newIndex = prev.findIndex((x) => x.key === over.id);
      return oldIndex < 0 || newIndex < 0 ? prev : arrayMove(prev, oldIndex, newIndex);
    });
  }

  function patchItem(key: string, patch: Partial<EditorItem>) {
    setItems((prev) => prev.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }

  function save() {
    templatesApi.saveTemplate(templateId, {
      name: name.trim() || 'Untitled',
      notes: notes.trim() || null,
      items: items.map((it, i) => {
        const firstWorking = it.sets.find((s) => s.type === 'normal') ?? it.sets[0];
        return {
          exercise_id: it.exercise.id,
          position: i,
          // Legacy default_* kept in sync for backwards compatibility.
          default_sets: it.sets.length,
          default_reps: firstWorking?.reps ?? null,
          default_weight: firstWorking?.weight ?? null,
          rest_seconds: it.restSeconds,
          sets: it.sets.map((s) => ({
            type: s.type,
            reps: s.reps,
            weight: s.weight,
            rest: s.rest,
          })),
        };
      }),
    });
    onClose();
  }

  return (
    <div className="mx-auto max-w-app space-y-4 p-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-base font-semibold outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
        />
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className="w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
      />

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
          <p className="text-sm text-gray-400">No exercises yet — add some below.</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((x) => x.key)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {items.map((it) => (
                <ExerciseCard
                  key={it.key}
                  item={it}
                  onPatch={(patch) => patchItem(it.key, patch)}
                  onRemove={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full rounded-2xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        + Add exercise
      </button>

      {items.length > 0 && (
        <p className="text-center text-[11px] text-gray-400">
          Tap a set number to cycle{' '}
          <span className="font-semibold text-amber-600 dark:text-amber-400">W</span>arm-up /{' '}
          <span className="font-semibold text-red-600 dark:text-red-400">F</span>ailure · drag{' '}
          <span className="font-medium">⠿</span> to reorder sets
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${name || 'this template'}"?`)) {
              templatesApi.deleteTemplate(templateId);
              onClose();
            }
          }}
          className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 dark:border-gray-700 dark:hover:bg-red-500/10"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={save}
          className="flex-1 rounded-xl bg-gray-800 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-700"
        >
          Save template
        </button>
      </div>

      {modalOpen && (
        <ExerciseModal
          exercises={exercises}
          onPick={(e) => {
            setItems((prev) => [
              ...prev,
              {
                key: crypto.randomUUID(),
                exercise: e,
                restSeconds: DEFAULT_REST_SECONDS,
                sets: Array.from({ length: 3 }, () => newSet()),
              },
            ]);
            setModalOpen(false);
          }}
          onClose={() => setModalOpen(false)}
          onCreateCustom={createCustom}
          onDeleteExercise={deleteExercise}
        />
      )}
    </div>
  );
}

// --- a sortable exercise block (mirrors the active-workout layout) ----------

function ExerciseCard({
  item,
  onPatch,
  onRemove,
}: {
  item: EditorItem;
  onPatch: (patch: Partial<EditorItem>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  const setSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function onSetDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = item.sets.findIndex((s) => s.id === active.id);
    const newIndex = item.sets.findIndex((s) => s.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onPatch({ sets: arrayMove(item.sets, oldIndex, newIndex) });
  }

  function patchSet(id: string, patch: Partial<EditorSet>) {
    onPatch({ sets: item.sets.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{item.exercise.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {item.exercise.muscle_groups.map((m) => (
              <span
                key={m}
                className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
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
            onClick={onRemove}
            aria-label="Remove exercise"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
          >
            ×
          </button>
        </div>
      </div>

      {/* per-exercise default rest */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2M9 2h6" strokeLinecap="round" />
        </svg>
        Rest
        <input
          type="number"
          inputMode="numeric"
          value={item.restSeconds ?? ''}
          placeholder={String(DEFAULT_REST_SECONDS)}
          onChange={(e) => onPatch({ restSeconds: num(e.target.value) })}
          className="w-14 rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-center text-xs outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
          aria-label="Default rest seconds"
        />
        s default — override per set below
      </div>

      {/* column headers */}
      <div className={`mt-3 ${SET_GRID} px-0 text-[10px] font-medium uppercase tracking-wide text-gray-400`}>
        <span className="text-center">#</span>
        <span className="text-center">lbs</span>
        <span className="text-center">reps</span>
        <span className="text-center">rest</span>
        <span />
        <span />
      </div>

      <DndContext sensors={setSensors} collisionDetection={closestCenter} onDragEnd={onSetDragEnd}>
        <SortableContext items={item.sets.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="mt-1 divide-y divide-gray-100 dark:divide-gray-800">
            {item.sets.map((s, i) => (
              <TemplateSetRow
                key={s.id}
                index={i}
                set={s}
                exerciseRest={item.restSeconds}
                onChange={(patch) => patchSet(s.id, patch)}
                onCycleType={() => patchSet(s.id, { type: SET_TYPE_NEXT[s.type] })}
                onDelete={() =>
                  onPatch({ sets: item.sets.filter((x) => x.id !== s.id) })
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() => onPatch({ sets: [...item.sets, newSet(item.sets[item.sets.length - 1])] })}
        className="mt-2 w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
      >
        + Add set
      </button>
    </div>
  );
}

function TemplateSetRow({
  index,
  set,
  exerciseRest,
  onChange,
  onCycleType,
  onDelete,
}: {
  index: number;
  set: EditorSet;
  exerciseRest: number | null;
  onChange: (patch: Partial<EditorSet>) => void;
  onCycleType: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: set.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const typeLabel = set.type === 'warmup' ? 'W' : set.type === 'failure' ? 'F' : index + 1;

  return (
    <div ref={setNodeRef} style={style} className={`${SET_GRID} bg-white py-1 dark:bg-gray-900`}>
      <button
        type="button"
        onClick={onCycleType}
        aria-label={`Set type: ${set.type}. Tap to change.`}
        title="Tap to cycle: normal → warm-up → failure"
        className={`text-center text-xs ${TYPE_CELL[set.type]}`}
      >
        {typeLabel}
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={set.weight ?? ''}
        onChange={(e) => onChange({ weight: num(e.target.value) })}
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
      <input
        type="number"
        inputMode="numeric"
        value={set.rest ?? ''}
        placeholder={exerciseRest != null ? String(exerciseRest) : String(DEFAULT_REST_SECONDS)}
        onChange={(e) => onChange({ rest: num(e.target.value) })}
        className={numInput}
        aria-label={`Set ${index + 1} rest seconds`}
      />
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reorder set"
        className="grid h-6 w-6 cursor-grab touch-none place-items-center rounded-md text-gray-300 hover:bg-gray-100 active:cursor-grabbing dark:hover:bg-gray-800"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" />
          <circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" />
          <circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" />
        </svg>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete set"
        className="grid h-6 w-6 place-items-center rounded-md text-gray-300 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
      >
        ×
      </button>
    </div>
  );
}
