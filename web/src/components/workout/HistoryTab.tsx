import { useMemo, useState } from 'react';
import { useWorkoutLogs } from '../../hooks/workout/useWorkoutLogs';
import {
  groupLogSets,
  logDurationMs,
  logTotals,
  sessionExercisesFromLog,
  templateItemsFromLog,
} from '../../lib/workoutFromLog';
import type { UseTemplates } from '../../hooks/workout/useTemplates';
import type { UseWorkoutSession } from '../../hooks/workout/useWorkoutSession';
import type { Exercise, WorkoutLogWithSets } from '../../types/workout';

interface Props {
  userId: string;
  exercises: Exercise[];
  /** Bumped after a workout is saved so the list refetches. */
  version: number;
  templatesApi: UseTemplates;
  sessionApi: UseWorkoutSession;
  /** Jump back to the Log tab after starting a repeat session. */
  onStarted: () => void;
}

function formatDuration(ms: number): string {
  if (!ms) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeOfDay(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function LogCard({
  log,
  exercises,
  templatesApi,
  sessionApi,
  onStarted,
  onDelete,
}: {
  log: WorkoutLogWithSets;
  exercises: Exercise[];
  templatesApi: UseTemplates;
  sessionApi: UseWorkoutSession;
  onStarted: () => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState(log.name);
  const [saving, setSaving] = useState(false);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  const groups = useMemo(() => groupLogSets(log, exercises), [log, exercises]);
  const totals = useMemo(() => logTotals(log), [log]);
  const freestyle = log.template_id === null;

  async function saveAsTemplate() {
    if (saving) return;
    setSaving(true);
    const items = templateItemsFromLog(log, exercises);
    const tpl = await templatesApi.createTemplateFrom(name.trim() || log.name, log.notes, items);
    setSaving(false);
    setNaming(false);
    if (tpl) setSavedAs(tpl.name);
  }

  function repeat() {
    if (sessionApi.session && !window.confirm('Replace the workout already in progress?')) return;
    sessionApi.startFromExercises(log.name, sessionExercisesFromLog(log, exercises));
    onStarted();
  }

  return (
    <div className="surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{log.name}</span>
            {freestyle && (
              <span className="shrink-0 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-700 dark:bg-accent-900/50 dark:text-accent-200">
                Freestyle
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500">
            {formatWhen(log.started_at)} · {formatTimeOfDay(log.started_at)} ·{' '}
            {formatDuration(logDurationMs(log))}
          </span>
          <span className="mt-1 block text-xs text-gray-500">
            {groups.length} exercise{groups.length === 1 ? '' : 's'} · {totals.sets} sets ·{' '}
            {Math.round(totals.volume).toLocaleString()} lbs
          </span>
        </span>
        <svg
          width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-800">
          {log.notes && (
            <p className="mb-3 whitespace-pre-wrap rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300">
              {log.notes}
            </p>
          )}

          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.exercise.id}>
                <p className="text-xs font-semibold">{g.exercise.name}</p>
                {g.note && <p className="mt-0.5 text-[11px] text-gray-500">{g.note}</p>}
                <div className="mt-1 flex flex-wrap gap-1">
                  {g.sets.map((s) => (
                    <span
                      key={s.id}
                      className={`rounded-lg px-1.5 py-0.5 text-[11px] ${
                        s.set_type === 'warmup'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                          : s.set_type === 'failure'
                            ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {s.weight_lbs ?? '—'}×{s.reps ?? '—'}
                      {s.rpe ? ` @${s.rpe}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-xs text-gray-400">No sets were logged in this session.</p>
            )}
          </div>

          {savedAs ? (
            <p className="mt-4 rounded-xl bg-green-50 px-3 py-2 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-300">
              Saved as template “{savedAs}” — it's on the Templates tab now.
            </p>
          ) : naming ? (
            <div className="mt-4 flex gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="Template name"
                className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-500 dark:border-gray-700 dark:bg-gray-950"
              />
              <button
                type="button"
                onClick={saveAsTemplate}
                disabled={saving}
                className="btn-accent shrink-0 px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setNaming(false)}
                className="shrink-0 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNaming(true)}
                disabled={groups.length === 0}
                className="btn-accent px-3 py-2 text-xs font-semibold disabled:opacity-50 disabled:shadow-none"
              >
                Save as template
              </button>
              <button
                type="button"
                onClick={repeat}
                disabled={groups.length === 0}
                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Repeat workout
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Delete this logged workout? This cannot be undone.'))
                    onDelete(log.id);
                }}
                className="ml-auto rounded-xl px-3 py-2 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Every finished session — including freestyle ones, which otherwise had no home
 * in the UI. Each entry can be expanded to review the sets, turned into a
 * reusable template, or repeated as a fresh session.
 */
export default function HistoryTab({
  userId,
  exercises,
  version,
  templatesApi,
  sessionApi,
  onStarted,
}: Props) {
  const { logs, loading, deleteLog } = useWorkoutLogs(userId, version);
  const [filter, setFilter] = useState<'all' | 'freestyle'>('all');

  const shown = filter === 'all' ? logs : logs.filter((l) => l.template_id === null);

  if (loading) {
    return (
      <div className="mx-auto max-w-app space-y-2 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-fab mx-auto max-w-app space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">History</h1>
          <p className="text-sm text-gray-500">
            Every session you've finished. Turn any of them into a template.
          </p>
        </div>
      </div>

      <div className="seg">
        {(['all', 'freestyle'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`seg-item capitalize ${filter === f ? 'seg-item-on' : 'seg-item-off'}`}
          >
            {f === 'all' ? 'All workouts' : 'Freestyle only'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-sm text-gray-400">
            {logs.length === 0
              ? 'No workouts logged yet — finish a session and it will show up here.'
              : 'No freestyle workouts yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((log) => (
            <LogCard
              key={log.id}
              log={log}
              exercises={exercises}
              templatesApi={templatesApi}
              sessionApi={sessionApi}
              onStarted={onStarted}
              onDelete={deleteLog}
            />
          ))}
        </div>
      )}
    </div>
  );
}
