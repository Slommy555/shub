import { useMemo } from 'react';
import { usePrograms } from '../../hooks/workout/usePrograms';
import { useTemplates } from '../../hooks/workout/useTemplates';
import { useWorkoutsDoneToday } from '../../hooks/workout/useWorkoutsDoneToday';
import { resolveDayWorkouts, type DayWorkout } from '../../lib/program';
import { setPendingWorkout, setPendingWorkoutSubTab } from '../../lib/workoutHandoff';
import type { Exercise } from '../../types/workout';
import { Card, CardSkeleton, SectionHeader } from './parts';

/** Home only needs template NAMES, so it hydrates against an empty library.
 *  Module-level so the reference is stable across renders. */
const NO_EXERCISES: Exercise[] = [];

/**
 * Where the active program has you today, and the buttons that start it.
 * Starting hands off through localStorage (see workoutHandoff) and switches to
 * the Workout tab, which picks the template up and opens the session — the same
 * path the voice assistant uses.
 *
 * A day can hold several workouts. They're run one session at a time, so each
 * gets its own row and its own Start; a row ticks off once a session logged
 * against that template lands today.
 */
export default function ProgramCard({
  userId,
  onOpenWorkout,
}: {
  userId: string;
  onOpenWorkout: () => void;
}) {
  const programs = usePrograms(userId);
  const { templates, loading: templatesLoading } = useTemplates(userId, NO_EXERCISES);
  const { counts, anyDone, loading: doneLoading } = useWorkoutsDoneToday(userId);

  const today = programs.today;
  const templateIds = today?.day.template_ids ?? [];

  /** Today's workouts, each paired with whether it's been done. */
  const workouts: DayWorkout[] = useMemo(() => {
    const names = new Map(templates.map((t) => [t.id, t.name] as const));
    return resolveDayWorkouts(templateIds, (id) => names.get(id), counts);
  }, [templateIds, templates, counts]);

  if (programs.loading || templatesLoading || doneLoading) return <CardSkeleton rows={2} />;

  const openProgramTab = () => {
    setPendingWorkoutSubTab('program');
    onOpenWorkout();
  };

  if (!today) {
    return (
      <Card>
        <SectionHeader title="Program" />
        <p className="text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
          {programs.activeProgram
            ? `${programs.activeProgram.name} — today is outside the program dates`
            : 'No active program'}
        </p>
        <button
          type="button"
          onClick={openProgramTab}
          className="mt-2 text-[13px] font-medium active:opacity-70"
          style={{ color: 'var(--color-accent)' }}
        >
          Open the Program tab
        </button>
      </Card>
    );
  }

  const names = workouts.map((w) => w.name);
  const dayTitle = today.day.is_rest
    ? 'Rest Day today'
    : (today.day.label ?? (names.length > 0 ? names.join(' + ') : `Day ${today.dayNumber}`));
  // With several workouts the list below already names them, so the sub-line
  // would just repeat itself.
  const daySub =
    today.day.is_rest || workouts.length > 1
      ? null
      : today.day.label && names.length > 0
        ? names[0]
        : null;

  /** Start one named template, or a freestyle session when the day names none. */
  function start(name: string | null) {
    setPendingWorkout(name ? { mode: 'template', name } : { mode: 'freestyle' });
    onOpenWorkout();
  }

  const allDone = workouts.length > 0 && workouts.every((w) => w.done);

  return (
    <Card>
      <SectionHeader
        title="Program"
        meta={`Week ${today.weekNumber} of ${today.program.total_weeks}`}
      />

      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
          {today.program.name}
        </span>
        {today.isDeload && (
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
            style={{ background: '#2e2010', color: 'var(--color-warning)', letterSpacing: '0.02em' }}
          >
            Deload
          </span>
        )}
      </div>

      <p
        className="text-[15px]"
        style={{ color: today.day.is_rest ? 'var(--color-text-secondary)' : 'var(--color-text-primary)' }}
      >
        Day {today.dayNumber} · {dayTitle}
      </p>
      {daySub && (
        <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {daySub}
        </p>
      )}

      {/* mt-auto keeps the CTA block on the card's bottom edge when it stretches. */}
      {workouts.length > 1 ? (
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {workouts.map((w, i) => (
            <div key={`${w.templateId}-${i}`} className="flex items-center gap-2">
              <span
                className="min-w-0 flex-1 truncate text-[15px]"
                style={{
                  color: w.done ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                  textDecoration: w.done ? 'line-through' : undefined,
                }}
              >
                {i + 1}. {w.name}
              </span>
              {w.done ? (
                <span
                  className="shrink-0 text-[15px] font-semibold"
                  style={{ color: 'var(--color-success)' }}
                >
                  ✓
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => start(w.name)}
                  className="shrink-0 rounded-full px-4 text-[13px] font-semibold active:scale-[0.98] active:opacity-85"
                  style={{ height: 40, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                >
                  Start
                </button>
              )}
            </div>
          ))}
          {allDone && (
            <p className="text-[15px] font-semibold" style={{ color: 'var(--color-success)' }}>
              ✓ All workouts complete
            </p>
          )}
        </div>
      ) : anyDone ? (
        <p className="mt-auto pt-4 text-[15px] font-semibold" style={{ color: 'var(--color-success)' }}>
          ✓ Workout complete
        </p>
      ) : (
        <button
          type="button"
          onClick={() => start(names[0] ?? null)}
          className="mt-auto w-full shrink-0 rounded-full text-[15px] font-semibold active:scale-[0.98] active:opacity-85"
          style={{ height: 52, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
        >
          Start Workout
        </button>
      )}
    </Card>
  );
}
