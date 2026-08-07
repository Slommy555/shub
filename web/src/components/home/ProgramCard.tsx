import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePrograms } from '../../hooks/workout/usePrograms';
import { useTemplates } from '../../hooks/workout/useTemplates';
import { setPendingWorkout, setPendingWorkoutSubTab } from '../../lib/workoutHandoff';
import { todayISO } from '../../lib/dates';
import type { Exercise } from '../../types/workout';
import { Card, CardSkeleton, SectionHeader } from './parts';

/** Home only needs template NAMES, so it hydrates against an empty library.
 *  Module-level so the reference is stable across renders. */
const NO_EXERCISES: Exercise[] = [];

/** True once a workout has been completed today (any session, program or not). */
function useWorkoutDoneToday(userId: string): { done: boolean; loading: boolean } {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = `${todayISO()}T00:00:00`;
      const { data, error } = await supabase
        .from('workout_logs')
        .select('id')
        .eq('user_id', userId)
        .not('completed_at', 'is', null)
        .gte('completed_at', new Date(start).toISOString())
        .limit(1);
      if (cancelled) return;
      if (error) console.error('Failed to check today’s workout:', error.message);
      setDone((data ?? []).length > 0);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { done, loading };
}

/**
 * Where the active program has you today, and the one button that starts it.
 * Starting hands off through localStorage (see workoutHandoff) and switches to
 * the Workout tab, which picks the template up and opens the session — the same
 * path the voice assistant uses.
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
  const { done: workoutDone, loading: doneLoading } = useWorkoutDoneToday(userId);

  const templateName = useMemo(() => {
    const map = new Map(templates.map((t) => [t.id, t.name] as const));
    return (id: string | null) => (id ? map.get(id) ?? null : null);
  }, [templates]);

  if (programs.loading || templatesLoading || doneLoading) return <CardSkeleton rows={2} />;

  const openProgramTab = () => {
    setPendingWorkoutSubTab('program');
    onOpenWorkout();
  };

  const today = programs.today;

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

  const tplName = templateName(today.day.template_id);
  const dayTitle = today.day.is_rest
    ? 'Rest Day today'
    : (today.day.label ?? tplName ?? `Day ${today.dayNumber}`);
  const daySub = today.day.is_rest ? null : today.day.label && tplName ? tplName : null;

  function startWorkout() {
    if (tplName) setPendingWorkout({ mode: 'template', name: tplName });
    else setPendingWorkout({ mode: 'freestyle' });
    onOpenWorkout();
  }

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

      {/* mt-auto keeps the CTA on the card's bottom edge when it stretches. */}
      {workoutDone ? (
        <p className="mt-auto pt-4 text-[15px] font-semibold" style={{ color: 'var(--color-success)' }}>
          ✓ Workout complete
        </p>
      ) : (
        <button
          type="button"
          onClick={startWorkout}
          className="mt-auto w-full shrink-0 rounded-full text-[15px] font-semibold active:scale-[0.98] active:opacity-85"
          style={{ height: 52, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
        >
          Start Workout
        </button>
      )}
    </Card>
  );
}
