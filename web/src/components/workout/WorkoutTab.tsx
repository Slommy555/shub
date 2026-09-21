import { useEffect, useRef, useState } from 'react';
import { useExercises } from '../../hooks/workout/useExercises';
import { useTemplates } from '../../hooks/workout/useTemplates';
import { useWorkoutSession } from '../../hooks/workout/useWorkoutSession';
import { usePrograms } from '../../hooks/workout/usePrograms';
import { useLastWeights } from '../../hooks/workout/useLastWeights';
import { fetchWorkoutsDoneToday } from '../../hooks/workout/useWorkoutsDoneToday';
import { rankMatches } from '../../lib/fuzzy';
import { resolveDayWorkouts, roundDownTo5 } from '../../lib/program';
import {
  clearPendingWorkout,
  readPendingWorkout,
  takePendingWorkoutSubTab,
} from '../../lib/workoutHandoff';
import { templateItemsFromSession } from '../../lib/workoutFromLog';
import type { TemplateItemInput } from '../../hooks/workout/useTemplates';
import type { SessionExercise } from '../../types/workout';
import type { NextUpWorkout } from './WorkoutSummaryCard';
import LogTab from './LogTab';
import TemplatesTab from './TemplatesTab';
import HistoryTab from './HistoryTab';
import MetricsTab from './MetricsTab';
import ProgramTab from './program/ProgramTab';

type SubTab = 'log' | 'program' | 'templates' | 'history' | 'metrics';

const SUBTABS: { id: SubTab; label: string }[] = [
  { id: 'log', label: 'Log' },
  { id: 'program', label: 'Program' },
  { id: 'templates', label: 'Templates' },
  { id: 'history', label: 'History' },
  { id: 'metrics', label: 'Metrics' },
];

export default function WorkoutTab({ userId, showRpe }: { userId: string; showRpe: boolean }) {
  const exercisesApi = useExercises(userId);
  const templatesApi = useTemplates(userId, exercisesApi.exercises);
  const sessionApi = useWorkoutSession(userId);
  const programsApi = usePrograms(userId);

  // Home can link straight to a sub-tab (currently only Program); otherwise Log.
  const [sub, setSub] = useState<SubTab>(() => {
    const pending = takePendingWorkoutSubTab();
    return SUBTABS.some((t) => t.id === pending) ? (pending as SubTab) : 'log';
  });
  // Bumped after finishing a workout so Metrics refetches completed sessions.
  const [version, setVersion] = useState(0);
  // The program workout still owed today, offered at the foot of the summary.
  const [nextUp, setNextUp] = useState<NextUpWorkout | null>(null);
  const { weights: lastWeights, loading: weightsLoading } = useLastWeights(userId, version);

  // Today's deload state comes from the active program (null outside one).
  const deload =
    programsApi.today?.isDeload === true
      ? { volumePct: programsApi.today.volumePct }
      : null;

  /**
   * During a deload week every set starts at `volumePct` of the last weight
   * actually logged for that exercise, rounded DOWN to the nearest 5 lb.
   * Exercises with no history return null and keep the template's planned weight.
   */
  const prefillWeight = deload
    ? (exerciseId: string): number | null => {
        const last = lastWeights[exerciseId];
        return last > 0 ? roundDownTo5(last * deload.volumePct) : null;
      }
    : undefined;

  /** The handoff must wait for these, or a deload session starts un-adjusted. */
  const prefillReady = !programsApi.loading && (!deload || !weightsLoading);

  /**
   * Today's program day resolved against what's actually been logged, read
   * fresh so the session that just finished is already counted. Returns the
   * first workout still outstanding — but only on a day that schedules more
   * than one, and only while one is genuinely unlogged.
   */
  async function findNextUp(): Promise<NextUpWorkout | null> {
    const day = programsApi.today?.day;
    const ids = day?.template_ids ?? [];
    if (day?.is_rest || ids.length < 2) return null;
    const { counts } = await fetchWorkoutsDoneToday(userId);
    const byId = new Map(templatesApi.templates.map((t) => [t.id, t] as const));
    const workouts = resolveDayWorkouts(ids, (id) => byId.get(id)?.name, counts);
    const index = workouts.findIndex((w) => !w.done);
    if (index < 0) return null; // every workout today is already logged
    const template = byId.get(workouts[index].templateId);
    if (!template) return null; // the day points at a deleted template
    return {
      template,
      position: index + 1,
      total: workouts.length,
      dayLabel: day?.label ?? null,
    };
  }

  function onWorkoutFinished() {
    setVersion((v) => v + 1);
    templatesApi.reload(); // refresh "last used" dates
    void findNextUp().then(setNextUp);
  }

  /**
   * "Save to Template" from the finish prompt. `templateId` is the id the
   * session has carried since it started, so the write lands on exactly the
   * template the workout came from; its whole exercise list is replaced with
   * the session as performed, leaving only the name and notes alone.
   */
  async function saveEditsToTemplate(templateId: string, items: TemplateItemInput[]) {
    const ok = await templatesApi.saveTemplateExercises(templateId, items);
    if (ok) templatesApi.reload(); // Templates tab shows the new plan right away
    return ok;
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

  // Honor a workout the Home tab or the voice assistant asked to start (set via
  // workoutHandoff, which navigates here). Wait for templates to load so we can
  // match by name, and never clobber a workout that's already in progress.
  // The deload pre-fill is read through a ref so the effect isn't re-run by the
  // fresh closure it would otherwise depend on.
  const handledHandoff = useRef(false);
  const prefillRef = useRef(prefillWeight);
  prefillRef.current = prefillWeight;
  const { templates, loading: templatesLoading } = templatesApi;
  const { session, startFreestyle, startFromTemplate } = sessionApi;
  useEffect(() => {
    if (handledHandoff.current || templatesLoading || !prefillReady) return;
    const cmd = readPendingWorkout();
    if (!cmd) return;
    handledHandoff.current = true;
    clearPendingWorkout();
    setSub('log');
    if (session) return; // resume the active session instead of replacing it
    if (cmd.mode === 'template') {
      const match = rankMatches(cmd.name, templates, (t) => t.name)[0]?.item;
      if (match) {
        startFromTemplate(match, prefillRef.current);
        return;
      }
    }
    startFreestyle();
  }, [templatesLoading, prefillReady, templates, session, startFreestyle, startFromTemplate]);

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
            onSaveToTemplate={saveEditsToTemplate}
            showRpe={showRpe}
            deload={deload}
            prefillWeight={prefillWeight}
            nextUp={nextUp}
            onClearNextUp={() => setNextUp(null)}
          />
        )}
        {sub === 'program' && (
          <ProgramTab api={programsApi} templates={templatesApi.templates} />
        )}
        {sub === 'templates' && (
          <TemplatesTab
            templatesApi={templatesApi}
            exercises={exercisesApi.exercises}
            createCustom={exercisesApi.createCustom}
            deleteExercise={exercisesApi.deleteExercise}
          />
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
      </div>
    </div>
  );
}
