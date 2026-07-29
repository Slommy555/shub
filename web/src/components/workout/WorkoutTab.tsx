import { useEffect, useRef, useState } from 'react';
import { useExercises } from '../../hooks/workout/useExercises';
import { useTemplates } from '../../hooks/workout/useTemplates';
import { useWorkoutSession } from '../../hooks/workout/useWorkoutSession';
import { rankMatches } from '../../lib/fuzzy';
import { clearPendingWorkout, readPendingWorkout } from '../../lib/workoutHandoff';
import { templateItemsFromSession } from '../../lib/workoutFromLog';
import type { SessionExercise } from '../../types/workout';
import LogTab from './LogTab';
import TemplatesTab from './TemplatesTab';
import HistoryTab from './HistoryTab';
import MetricsTab from './MetricsTab';
import WeightTab from './WeightTab';
import WorkoutScheduleSettings from './WorkoutScheduleSettings';

type SubTab = 'log' | 'templates' | 'history' | 'metrics' | 'weight';

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'weight', label: 'Weight' },
];

export default function WorkoutTab({ userId, showRpe }: { userId: string; showRpe: boolean }) {
  const exercisesApi = useExercises(userId);
  const templatesApi = useTemplates(userId, exercisesApi.exercises);
  const sessionApi = useWorkoutSession(userId);

  const [sub, setSub] = useState<SubTab>('log');
  // Bumped after finishing a workout so Metrics refetches completed sessions.
  const [version, setVersion] = useState(0);

  function onWorkoutFinished() {
    setVersion((v) => v + 1);
    templatesApi.reload(); // refresh "last used" dates
  }

  /** "Save as template" from the post-workout summary (freestyle → repeatable). */
  async function saveSessionAsTemplate(name: string, exercises: SessionExercise[]) {
    const tpl = await templatesApi.createTemplateFrom(
      name,
      null,
      templateItemsFromSession(exercises)
    );
    return tpl?.name ?? null;
  }

  // Honor a workout the voice assistant asked to start (set via workoutHandoff,
  // which navigates here). Wait for templates to load so we can match by name,
  // and never clobber a workout that's already in progress.
  const handledHandoff = useRef(false);
  const { templates, loading: templatesLoading } = templatesApi;
  const { session, startFreestyle, startFromTemplate } = sessionApi;
  useEffect(() => {
    if (handledHandoff.current || templatesLoading) return;
    const cmd = readPendingWorkout();
    if (!cmd) return;
    handledHandoff.current = true;
    clearPendingWorkout();
    setSub('log');
    if (session) return; // resume the active session instead of replacing it
    if (cmd.mode === 'template') {
      const match = rankMatches(cmd.name, templates, (t) => t.name)[0]?.item;
      if (match) {
        startFromTemplate(match);
        return;
      }
    }
    startFreestyle();
  }, [templatesLoading, templates, session, startFreestyle, startFromTemplate]);

  return (
    <div className="flex min-h-screen flex-col">
      {/* sub-navigation */}
      <nav className="glass sticky top-0 z-30 border-b px-3 py-2">
        <div className="mx-auto flex max-w-app gap-1 overflow-x-auto no-scrollbar">
          {SUBTABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSub(t.id)}
              aria-current={sub === t.id ? 'page' : undefined}
              className={`flex-1 whitespace-nowrap rounded-full px-3 py-2 text-sm font-semibold transition-all ${
                sub === t.id
                  ? 'bg-gray-800 text-white shadow-card dark:bg-gray-100 dark:text-gray-900'
                  : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* content (keyed so each sub-tab fades in) */}
      <div key={sub} className="flex-1 animate-fade-in">
        {sub === 'log' && (
          <LogTab
            exercises={exercisesApi.exercises}
            templates={templatesApi.templates}
            templatesLoading={templatesApi.loading}
            sessionApi={sessionApi}
            createCustom={exercisesApi.createCustom}
            deleteExercise={exercisesApi.deleteExercise}
            onWorkoutFinished={onWorkoutFinished}
            onSaveAsTemplate={saveSessionAsTemplate}
            showRpe={showRpe}
          />
        )}
        {sub === 'templates' && (
          <>
            <div className="mx-auto max-w-app px-4 pt-4">
              <WorkoutScheduleSettings
                userId={userId}
                templateNames={templatesApi.templates.map((t) => t.name)}
              />
            </div>
            <TemplatesTab
              templatesApi={templatesApi}
              exercises={exercisesApi.exercises}
              createCustom={exercisesApi.createCustom}
              deleteExercise={exercisesApi.deleteExercise}
            />
          </>
        )}
        {sub === 'history' && (
          <HistoryTab
            userId={userId}
            exercises={exercisesApi.exercises}
            version={version}
            templatesApi={templatesApi}
            sessionApi={sessionApi}
            onStarted={() => setSub('log')}
          />
        )}
        {sub === 'metrics' && (
          <MetricsTab userId={userId} exercises={exercisesApi.exercises} version={version} />
        )}
        {sub === 'weight' && <WeightTab userId={userId} />}
      </div>
    </div>
  );
}
