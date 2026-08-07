import { useMemo, useState } from 'react';
import type { TemplateWithExercises, WorkoutProgram } from '../../../types/workout';
import type { UsePrograms } from '../../../hooks/workout/usePrograms';
import { dateForCycleDay, resolveDay, weekRangeLabel } from '../../../lib/program';
import { parseISO, todayISO } from '../../../lib/dates';
import DayEditSheet, { type DayDraft } from './DayEditSheet';

/** Which day the editor sheet is open on: the default split, or one week. */
type Editing =
  | { scope: 'default'; dayNumber: number }
  | { scope: 'week'; weekNumber: number; dayNumber: number };

/** Amber tint used for deload weeks (warning color at low alpha). */
const DELOAD_TINT = 'color-mix(in srgb, var(--color-warning) 14%, transparent)';

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-2 text-[13px] font-medium uppercase"
      style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
    >
      {children}
    </h2>
  );
}

/** "Mon" for a 7-day cycle day, "Day 3" for an 8-day one (which isn't weekday-tied). */
function dayHeading(program: WorkoutProgram, weekNumber: number, dayNumber: number): string {
  if (program.cycle_length !== 7) return `Day ${dayNumber}`;
  const iso = dateForCycleDay(program, weekNumber, dayNumber);
  return parseISO(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

/** An inline note field that commits on blur (never on every keystroke). */
function NoteInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== value) onSave(text);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      placeholder="Add note"
      className="mt-2 w-full rounded-xl border px-3 py-2 text-[13px] outline-none"
      style={{
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}

/**
 * A program as a calendar: one row per week (a full pass of the cycle), each
 * with its day cells, a deload toggle and a note. The default split lives above
 * the calendar — editing a day there changes every week that hasn't been
 * overridden; editing a day inside a week row writes an override on that week
 * only (program_weeks.override_days).
 */
export default function ProgramDetail({
  program,
  api,
  templates,
  onBack,
}: {
  program: WorkoutProgram;
  api: UsePrograms;
  templates: TemplateWithExercises[];
  onBack: () => void;
}) {
  const [editing, setEditing] = useState<Editing | null>(null);

  const defaults = useMemo(() => api.daysFor(program.id), [api, program.id]);
  const templateName = useMemo(() => {
    const map = new Map(templates.map((t) => [t.id, t.name] as const));
    return (id: string | null) => (id ? map.get(id) ?? 'Deleted template' : null);
  }, [templates]);

  const today = todayISO();
  const dayNumbers = Array.from({ length: program.cycle_length }, (_, i) => i + 1);
  const weekNumbers = Array.from({ length: program.total_weeks }, (_, i) => i + 1);

  /** What the sheet should open with, and where saving it should write. */
  function editorProps() {
    if (!editing) return null;
    if (editing.scope === 'default') {
      const d = resolveDay(editing.dayNumber, defaults, null);
      return {
        title: `Day ${editing.dayNumber} — default split`,
        scopeNote: 'Changes every week that has no override of its own.',
        value: { template_id: d.template_id, label: d.label, is_rest: d.is_rest } as DayDraft,
        onSave: (draft: DayDraft) =>
          void api.setDefaultDay(program.id, editing.dayNumber, draft),
        onReset: undefined,
      };
    }
    const week = api.weekFor(program.id, editing.weekNumber);
    const d = resolveDay(editing.dayNumber, defaults, week);
    return {
      title: `Week ${editing.weekNumber} · Day ${editing.dayNumber}`,
      scopeNote: `Changes this day in week ${editing.weekNumber} only.`,
      value: { template_id: d.template_id, label: d.label, is_rest: d.is_rest } as DayDraft,
      onSave: (draft: DayDraft) =>
        void api.setWeekDayOverride(program.id, editing.weekNumber, editing.dayNumber, draft),
      onReset: d.overridden
        ? () => void api.setWeekDayOverride(program.id, editing.weekNumber, editing.dayNumber, null)
        : undefined,
    };
  }
  const editor = editorProps();

  return (
    <div className="pb-fab mx-auto w-full max-w-app px-4 py-5 sm:px-6">
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to programs"
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-xl active:opacity-70"
          style={{ color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1
          className="min-w-0 flex-1 truncate text-xl font-bold"
          style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
        >
          {program.name}
        </h1>
        <button
          type="button"
          onClick={() => void api.setActive(program.id, !program.is_active)}
          className="shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium"
          style={
            program.is_active
              ? { background: 'var(--color-accent)', borderColor: 'transparent', color: 'var(--color-accent-text)' }
              : { borderColor: 'var(--color-border-strong)', color: 'var(--color-text-secondary)' }
          }
        >
          {program.is_active ? 'Active' : 'Set active'}
        </button>
      </div>
      <p className="mb-6 pl-11 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {program.cycle_length}-day cycle · {program.total_weeks} weeks · starts{' '}
        {parseISO(program.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>

      {/* Default split */}
      <SectionHeader>Default split</SectionHeader>
      <div
        className="mb-6 overflow-hidden rounded-2xl border"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
      >
        {dayNumbers.map((n, i) => {
          const d = resolveDay(n, defaults, null);
          const name = d.is_rest ? 'Rest' : (d.label ?? templateName(d.template_id) ?? 'Not set');
          return (
            <button
              key={n}
              type="button"
              onClick={() => setEditing({ scope: 'default', dayNumber: n })}
              className="flex w-full items-center gap-3 px-4 py-3 text-left active:opacity-80"
              style={{
                minHeight: 56,
                borderTop: i === 0 ? undefined : '1px solid var(--color-border)',
              }}
            >
              <span
                className="w-14 shrink-0 text-[13px] font-medium"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Day {n}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-[15px] font-medium"
                style={{ color: d.is_rest || name === 'Not set' ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)' }}
              >
                {name}
              </span>
              {!d.is_rest && d.label && templateName(d.template_id) && (
                <span className="shrink-0 truncate text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {templateName(d.template_id)}
                </span>
              )}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          );
        })}
      </div>

      {/* Calendar */}
      <SectionHeader>Calendar</SectionHeader>
      <div className="flex flex-col gap-3">
        {weekNumbers.map((wn) => {
          const week = api.weekFor(program.id, wn);
          const isDeload = week?.is_deload === true;
          const pct = Number(week?.deload_volume_pct);
          const volumePct = Number.isFinite(pct) && pct > 0 ? pct : 0.6;
          return (
            <div
              key={wn}
              className="rounded-2xl border p-4"
              style={{
                background: isDeload ? DELOAD_TINT : 'var(--color-bg-elevated)',
                borderColor: isDeload ? 'var(--color-warning)' : 'var(--color-border)',
              }}
            >
              {/* Week header */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  Week {wn}
                </span>
                {isDeload && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                    style={{ background: '#2e2010', color: 'var(--color-warning)', letterSpacing: '0.02em' }}
                  >
                    Deload
                  </span>
                )}
                <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                  {weekRangeLabel(program, wn)}
                </span>
                <button
                  type="button"
                  onClick={() => void api.setWeekFields(program.id, wn, { is_deload: !isDeload })}
                  aria-pressed={isDeload}
                  className="ml-auto shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium"
                  style={
                    isDeload
                      ? { background: 'var(--color-warning)', borderColor: 'transparent', color: '#16161f' }
                      : { borderColor: 'var(--color-border-strong)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {isDeload ? 'Deload on' : 'Mark as Deload'}
                </button>
              </div>

              {/* Deload volume */}
              {isDeload && (
                <div className="mb-3 flex items-center gap-3">
                  <input
                    type="range"
                    min={0.3}
                    max={1}
                    step={0.05}
                    value={volumePct}
                    aria-label={`Week ${wn} deload volume`}
                    onChange={(e) =>
                      void api.setWeekFields(program.id, wn, {
                        deload_volume_pct: Number(e.target.value),
                      })
                    }
                    className="min-w-0 flex-1"
                  />
                  <span
                    className="w-24 shrink-0 text-right text-[13px] tabular-nums"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {Math.round(volumePct * 100)}% volume
                  </span>
                </div>
              )}

              {/* Day cells */}
              <div className="-mx-1 overflow-x-auto px-1">
                <div
                  className="grid gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${program.cycle_length}, minmax(78px, 1fr))`,
                  }}
                >
                  {dayNumbers.map((dn) => {
                    const d = resolveDay(dn, defaults, week);
                    const iso = dateForCycleDay(program, wn, dn);
                    const isToday = iso === today;
                    const name = d.is_rest
                      ? 'Rest'
                      : (d.label ?? templateName(d.template_id) ?? '—');
                    return (
                      <button
                        key={dn}
                        type="button"
                        onClick={() => setEditing({ scope: 'week', weekNumber: wn, dayNumber: dn })}
                        className="flex flex-col items-start gap-1 rounded-xl border p-2 text-left active:opacity-80"
                        style={{
                          minHeight: 68,
                          background: d.is_rest ? 'transparent' : 'var(--color-accent-subtle)',
                          borderColor: isToday ? 'var(--color-accent)' : 'var(--color-border)',
                          borderWidth: isToday ? 2 : 1,
                        }}
                      >
                        <span
                          className="text-[11px] font-medium"
                          style={{ color: isToday ? 'var(--color-accent)' : 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
                        >
                          {dayHeading(program, wn, dn)}
                        </span>
                        <span
                          className="line-clamp-2 text-[12px] font-medium leading-tight"
                          style={{
                            color: d.is_rest ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                          }}
                        >
                          {name}
                        </span>
                        {d.overridden && (
                          <span className="text-[10px]" style={{ color: 'var(--color-warning)' }}>
                            edited
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <NoteInput
                value={week?.notes ?? ''}
                onSave={(v) => void api.setWeekFields(program.id, wn, { notes: v.trim() || null })}
              />
            </div>
          );
        })}
      </div>

      {editor && editing && (
        <DayEditSheet
          title={editor.title}
          scopeNote={editor.scopeNote}
          templates={templates}
          value={editor.value}
          onSave={editor.onSave}
          onReset={editor.onReset}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
