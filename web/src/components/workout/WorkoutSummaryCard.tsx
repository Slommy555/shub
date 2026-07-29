import { useState } from 'react';
import {
  MUSCLE_LABELS,
  type SessionExercise,
  type WorkoutSummary,
} from '../../types/workout';

export interface FinishedWorkout {
  summary: WorkoutSummary;
  /** What was in the session when it was saved — lets us build a template. */
  name: string;
  exercises: SessionExercise[];
  /** True when the 2h30m cap ended the session rather than the user. */
  auto: boolean;
}

interface Props {
  finished: FinishedWorkout;
  onSaveAsTemplate: (name: string, exercises: SessionExercise[]) => Promise<string | null>;
  onDone: () => void;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 px-3 py-2.5 dark:bg-gray-800/60">
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

/**
 * The post-workout screen. It lives outside the active session (which is torn
 * down the moment the log is written) so it survives long enough to show the
 * numbers and offer "Save as template".
 */
export default function WorkoutSummaryCard({ finished, onSaveAsTemplate, onDone }: Props) {
  const { summary, name, exercises, auto } = finished;
  const [tplName, setTplName] = useState(name === 'Freestyle Workout' ? '' : name);
  const [saving, setSaving] = useState(false);
  const [savedAs, setSavedAs] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    const created = await onSaveAsTemplate(tplName.trim() || name, exercises);
    setSaving(false);
    if (created) setSavedAs(created);
  }

  return (
    <div className="pb-fab mx-auto max-w-app p-4">
      <div className="surface animate-pop-in rounded-3xl p-6 text-center">
        <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-b from-accent-500 to-accent-600 text-white shadow-glow">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 12.5l3.2 3.2L17 9" />
          </svg>
        </div>
        <h2 className="text-xl font-bold">Workout complete</h2>
        <p className="mt-1 text-sm text-gray-500">{name}</p>

        {auto && (
          <p className="mx-auto mt-3 max-w-xs rounded-2xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            This session hit the 2h30m limit, so it was ended and saved for you.
          </p>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5 text-left">
          <Stat label="Volume" value={`${Math.round(summary.totalVolume).toLocaleString()} lbs`} />
          <Stat label="Duration" value={formatDuration(summary.durationMs)} />
          <Stat label="Exercises" value={String(summary.exerciseCount)} />
          <Stat label="Sets" value={String(summary.totalSets)} />
        </div>

        {summary.muscleGroups.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-1">
            {summary.muscleGroups.map((m) => (
              <span
                key={m}
                className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
              >
                {MUSCLE_LABELS[m]}
              </span>
            ))}
          </div>
        )}

        {/* Turn what you just did into a repeatable template — the main way a
            freestyle session becomes something you can run again. */}
        {exercises.length > 0 && (
          <div className="mt-5 rounded-2xl border border-gray-200 p-3 text-left dark:border-gray-800">
            {savedAs ? (
              <p className="text-center text-xs font-medium text-green-600 dark:text-green-400">
                Saved as template “{savedAs}”.
              </p>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  Save as template
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Keep this exact set-up so you can repeat it in one tap.
                </p>
                <div className="mt-2 flex gap-2">
                  <input
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder={name}
                    aria-label="Template name"
                    className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-accent-500 dark:border-gray-700 dark:bg-gray-950"
                  />
                  <button
                    type="button"
                    onClick={save}
                    disabled={saving}
                    className="btn-accent shrink-0 px-3 py-2 text-xs font-semibold disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onDone}
          className="mt-4 w-full rounded-2xl bg-gray-800 px-4 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
        >
          Done
        </button>
        <p className="mt-2 text-[11px] text-gray-400">
          Saved — find it any time under Workout → History.
        </p>
      </div>
    </div>
  );
}
