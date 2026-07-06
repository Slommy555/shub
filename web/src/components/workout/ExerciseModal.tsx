import { useMemo, useState } from 'react';
import {
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  MUSCLE_REGIONS,
  type Exercise,
  type MuscleGroup,
} from '../../types/workout';

interface Props {
  exercises: Exercise[];
  onPick: (e: Exercise) => void;
  onClose: () => void;
  onCreateCustom: (name: string, groups: MuscleGroup[]) => Promise<Exercise | null>;
  onDeleteExercise: (id: string) => void;
}

const chip =
  'rounded-full px-2.5 py-1 text-xs font-medium transition-colors';

export default function ExerciseModal({
  exercises,
  onPick,
  onClose,
  onCreateCustom,
  onDeleteExercise,
}: Props) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MuscleGroup | null>(null);
  const [creating, setCreating] = useState(false);

  // custom-creator state
  const [name, setName] = useState('');
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (filter && !e.muscle_groups.includes(filter)) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, query, filter]);

  function toggleGroup(g: MuscleGroup) {
    setGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }

  async function saveCustom() {
    if (!name.trim() || groups.length === 0 || saving) return;
    setSaving(true);
    const created = await onCreateCustom(name.trim(), groups);
    setSaving(false);
    if (!created) return;

    // Offer to remove the user's own custom duplicates of the same name.
    const dupes = exercises.filter(
      (e) =>
        e.id !== created.id &&
        e.is_custom &&
        e.name.trim().toLowerCase() === created.name.toLowerCase()
    );
    if (dupes.length > 0) {
      const ok = window.confirm(
        `You already have ${dupes.length} custom exercise${
          dupes.length > 1 ? 's' : ''
        } named “${created.name}”. Delete ${dupes.length > 1 ? 'them' : 'it'}?`
      );
      if (ok) dupes.forEach((d) => onDeleteExercise(d.id));
    }
    onPick(created);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-3xl bg-white shadow-xl animate-slide-up dark:bg-gray-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exercises…"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Close
          </button>
        </div>

        {/* muscle filter chips */}
        <div className="flex flex-wrap gap-1.5 border-b border-gray-100 p-3 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setFilter(null)}
            className={`${chip} ${
              filter === null
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            All
          </button>
          {MUSCLE_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setFilter(filter === g ? null : g)}
              className={`${chip} whitespace-nowrap ${
                filter === g
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {MUSCLE_LABELS[g]}
            </button>
          ))}
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {filtered.length === 0 && !creating && (
            <p className="px-3 py-8 text-center text-sm text-gray-400">
              No exercises match. Create a custom one below.
            </p>
          )}
          {filtered.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-1 rounded-xl pr-1 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <button
                type="button"
                onClick={() => onPick(e)}
                className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{e.name}</span>
                </span>
                {e.is_custom && (
                  <span className="shrink-0 text-[10px] font-medium text-gray-400">custom</span>
                )}
              </button>
              {e.is_custom && (
                <button
                  type="button"
                  aria-label={`Delete ${e.name}`}
                  title="Delete custom exercise"
                  onClick={() => {
                    if (window.confirm(`Delete custom exercise “${e.name}”? This can’t be undone.`)) {
                      onDeleteExercise(e.id);
                    }
                  }}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>

        {/* custom creator */}
        <div className="border-t border-gray-100 p-3 dark:border-gray-800">
          {!creating ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              + Create custom exercise
            </button>
          ) : (
            <div className="space-y-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Exercise name"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950"
              />
              {/* selected summary — makes the current selection obvious */}
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-gray-50 px-2 py-2 dark:bg-gray-800/60">
                <span className="text-[11px] font-semibold text-gray-500">
                  Selected ({groups.length}):
                </span>
                {groups.length === 0 ? (
                  <span className="text-[11px] text-gray-400">none yet — tap muscles below</span>
                ) : (
                  groups.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGroup(g)}
                      className="flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-gray-200 dark:text-gray-900"
                    >
                      {MUSCLE_LABELS[g]}
                      <span className="text-gray-300 dark:text-gray-500">×</span>
                    </button>
                  ))
                )}
              </div>

              <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-100 p-2 dark:border-gray-800">
                {MUSCLE_REGIONS.map(({ region, groups: regionGroups }) => (
                  <div key={region}>
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {region}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {regionGroups.map((g) => {
                        const on = groups.includes(g);
                        return (
                          <button
                            key={g}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleGroup(g)}
                            className={`${chip} ${
                              on
                                ? 'bg-gray-800 text-white ring-2 ring-gray-900 ring-offset-1 ring-offset-white dark:bg-gray-100 dark:text-gray-900 dark:ring-gray-100 dark:ring-offset-gray-900'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                            }`}
                          >
                            {on && <span className="mr-0.5">✓</span>}
                            {MUSCLE_LABELS[g]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCustom}
                  disabled={!name.trim() || groups.length === 0 || saving}
                  className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Save & add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
