import { useState } from 'react';
import {
  type Exercise,
  type MuscleGroup,
  type SessionExercise,
  type TemplateWithExercises,
} from '../../types/workout';
import type { UseWorkoutSession } from '../../hooks/workout/useWorkoutSession';
import ActiveWorkoutSession from './ActiveWorkoutSession';
import WorkoutSummaryCard, { type FinishedWorkout } from './WorkoutSummaryCard';

interface Props {
  exercises: Exercise[];
  templates: TemplateWithExercises[];
  templatesLoading: boolean;
  sessionApi: UseWorkoutSession;
  createCustom: (name: string, groups: MuscleGroup[]) => Promise<Exercise | null>;
  deleteExercise: (id: string) => void;
  onWorkoutFinished: () => void;
  onSaveAsTemplate: (name: string, exercises: SessionExercise[]) => Promise<string | null>;
  showRpe: boolean;
  /** Set when today falls in a deload week of the active program. */
  deload?: { volumePct: number } | null;
  /** Deload starting weight per exercise (null = keep the template's plan). */
  prefillWeight?: (exerciseId: string) => number | null;
}

/** "Deload Week — working at 60% today", shown while a deload week is running. */
function DeloadBanner({ pct }: { pct: number }) {
  return (
    <div
      className="mx-auto mb-4 flex max-w-app items-center gap-2.5 rounded-2xl border px-4 py-3"
      style={{
        background: 'color-mix(in srgb, var(--color-warning, #f0a04b) 14%, transparent)',
        borderColor: 'var(--color-warning, #f0a04b)',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f0a04b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1" />
      </svg>
      <span className="text-sm font-semibold" style={{ color: '#f0a04b' }}>
        Deload Week — working at {Math.round(pct * 100)}% today
      </span>
    </div>
  );
}

export default function LogTab({
  exercises,
  templates,
  templatesLoading,
  sessionApi,
  createCustom,
  deleteExercise,
  onWorkoutFinished,
  onSaveAsTemplate,
  showRpe,
  deload,
  prefillWeight,
}: Props) {
  // Finishing clears the session from the store, so the summary is held here —
  // otherwise the active-session screen unmounts before it can be shown.
  const [finished, setFinished] = useState<FinishedWorkout | null>(null);

  const startTemplate = (t: TemplateWithExercises) =>
    sessionApi.startFromTemplate(t, prefillWeight);

  // Active session takes over the whole tab.
  if (sessionApi.session) {
    return (
      <>
        {deload && (
          <div className="px-4 pt-4">
            <DeloadBanner pct={deload.volumePct} />
          </div>
        )}
        <ActiveWorkoutSession
          api={sessionApi}
          exercises={exercises}
          onCreateCustom={createCustom}
          onDeleteExercise={deleteExercise}
          onFinished={(summary, snapshot, auto) => {
            setFinished({ summary, name: snapshot.name, exercises: snapshot.exercises, auto });
            onWorkoutFinished();
          }}
          showRpe={showRpe}
        />
      </>
    );
  }

  if (finished) {
    return (
      <WorkoutSummaryCard
        finished={finished}
        onSaveAsTemplate={onSaveAsTemplate}
        onDone={() => setFinished(null)}
      />
    );
  }

  return (
    <div className="pb-fab mx-auto max-w-app space-y-5 p-4">
      {deload && <DeloadBanner pct={deload.volumePct} />}

      <div>
        <h1 className="text-lg font-bold">Start a workout</h1>
        <p className="text-sm text-gray-500">Pick a template or go freestyle.</p>
      </div>

      <button
        type="button"
        onClick={() => sessionApi.startFreestyle()}
        className="btn-accent flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span>
          <span className="block text-sm font-semibold">Freestyle workout</span>
          <span className="block text-xs text-white/80">
            Blank session — save it as a template when you're done
          </span>
        </span>
      </button>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Start from template</h2>

        {templatesLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
            <p className="text-sm text-gray-400">
              No templates yet — build one in the Templates tab, or just go freestyle.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => startTemplate(t)}
                className="surface flex w-full items-center justify-between gap-3 p-4 text-left transition-[transform,background-color] hover:bg-gray-50 active:scale-[0.99] dark:hover:bg-gray-800"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{t.name}</span>
                  <span className="block text-xs text-gray-500">
                    {t.exercise_count} exercise{t.exercise_count === 1 ? '' : 's'}
                  </span>
                </span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-gray-400">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
