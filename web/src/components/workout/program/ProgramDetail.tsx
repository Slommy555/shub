import { useMemo, useState } from 'react';
import type { TemplateWithExercises, WorkoutProgram } from '../../../types/workout';
import type { UsePrograms } from '../../../hooks/workout/usePrograms';
import {
  WEEK_DAYS,
  cycleDayFor,
  dateForWeekDay,
  resolveDay,
  weekRangeLabel,
} from '../../../lib/program';
import { parseISO, todayISO } from '../../../lib/dates';
import DayEditSheet, { type DayDraft } from './DayEditSheet';
import Sheet from './Sheet';

const inputStyle: React.CSSProperties = {
  height: 48,
  background: 'var(--color-bg-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-1.5 block text-[11px] font-medium uppercase"
      style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
    >
      {children}
    </span>
  );
}

/**
 * Edit the block itself. Moving the start date slides the whole calendar — every
 * week and every cycle day re-derives from it, so nothing else has to change.
 */
function ProgramEditSheet({
  program,
  onSave,
  onClose,
}: {
  program: WorkoutProgram;
  onSave: (patch: { name: string; start_date: string; total_weeks: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(program.name);
  const [startDate, setStartDate] = useState(program.start_date);
  const [weeks, setWeeks] = useState(String(program.total_weeks));
  const nextWeeks = Math.max(1, Math.min(104, Number(weeks) || program.total_weeks));

  return (
    <Sheet title="Edit program" onClose={onClose}>
      <label className="mb-4 block">
        <FieldLabel>Name</FieldLabel>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border px-4 text-[15px] outline-none"
          style={inputStyle}
        />
      </label>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block">
          <FieldLabel>Start date</FieldLabel>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border px-3 text-[15px] outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <FieldLabel>Total weeks</FieldLabel>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={104}
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            className="w-full rounded-xl border px-4 text-[15px] tabular-nums outline-none"
            style={inputStyle}
          />
        </label>
      </div>

      <p className="mb-5 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        {startDate !== program.start_date && 'Moving the start date shifts every week and cycle day. '}
        {nextWeeks < program.total_weeks
          ? `Cutting to ${nextWeeks} weeks discards the deload settings and notes on weeks ${nextWeeks + 1}–${program.total_weeks}.`
          : `The ${program.cycle_length}-day cycle is set when the program is created and can't be changed here.`}
      </p>

      <button
        type="button"
        onClick={() => {
          onSave({ name, start_date: startDate || program.start_date, total_weeks: nextWeeks });
          onClose();
        }}
        className="w-full rounded-full text-[15px] font-semibold active:scale-[0.98] active:opacity-85"
        style={{ height: 52, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
      >
        Save
      </button>
    </Sheet>
  );
}

/**
 * Which day the editor sheet is open on: a day of the default split, or one
 * cycle day inside one calendar week (`iso` is only for the sheet's title).
 */
type Editing =
  | { scope: 'default'; dayNumber: number }
  | { scope: 'week'; weekNumber: number; dayNumber: number; iso: string };

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

/** "Mon 11" — the calendar identity of a cell, since weeks are real weeks. */
function dayHeading(iso: string): string {
  const d = parseISO(iso);
  return `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.getDate()}`;
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
 * A program as a calendar: one row per CALENDAR week (always 7 days), each with
 * its day cells, a deload toggle and a note. The split rotates on its own
 * `cycle_length`, so with an 8-day cycle the Day 1–8 badges drift one weekday
 * later each week and any given week shows 7 of the 8.
 *
 * The default split lives above the calendar — editing a day there changes every
 * week that hasn't been overridden; editing a day inside a week row writes an
 * override on that week only (program_weeks.override_days).
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
  const [editingProgram, setEditingProgram] = useState(false);

  const defaults = useMemo(() => api.daysFor(program.id), [api, program.id]);
  const templateName = useMemo(() => {
    const map = new Map(templates.map((t) => [t.id, t.name] as const));
    return (id: string | null) => (id ? map.get(id) ?? 'Deleted template' : null);
  }, [templates]);

  const today = todayISO();
  /** The split's own days (1..cycle_length) — the Default split rows. */
  const dayNumbers = Array.from({ length: program.cycle_length }, (_, i) => i + 1);
  /** Positions within a calendar week (1..7) — the calendar's columns. */
  const weekDayIndexes = Array.from({ length: WEEK_DAYS }, (_, i) => i + 1);
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
      title: `Week ${editing.weekNumber} · ${dayHeading(editing.iso)}`,
      scopeNote: `Changes Day ${editing.dayNumber} in week ${editing.weekNumber} only.`,
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
      <button
        type="button"
        onClick={() => setEditingProgram(true)}
        className="mb-6 flex items-center gap-1.5 pl-11 text-[13px] active:opacity-70"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span>
          {program.cycle_length}-day cycle · {program.total_weeks} weeks · starts{' '}
          {parseISO(program.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" style={{ color: 'var(--color-accent)' }}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>

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

              {/* Day cells — always the 7 days of the calendar week. */}
              <div className="-mx-1 overflow-x-auto px-1">
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${WEEK_DAYS}, minmax(78px, 1fr))` }}
                >
                  {weekDayIndexes.map((i) => {
                    const iso = dateForWeekDay(program, wn, i);
                    const cycleDay = cycleDayFor(program, iso);
                    const d = resolveDay(cycleDay, defaults, week);
                    const isToday = iso === today;
                    const name = d.is_rest
                      ? 'Rest'
                      : (d.label ?? templateName(d.template_id) ?? '—');
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() =>
                          setEditing({ scope: 'week', weekNumber: wn, dayNumber: cycleDay, iso })
                        }
                        className="flex flex-col items-start gap-1 rounded-xl border p-2 text-left active:opacity-80"
                        style={{
                          minHeight: 72,
                          background: d.is_rest ? 'transparent' : 'var(--color-accent-subtle)',
                          borderColor: isToday ? 'var(--color-accent)' : 'var(--color-border)',
                          borderWidth: isToday ? 2 : 1,
                        }}
                      >
                        <span className="flex w-full items-baseline justify-between gap-1">
                          <span
                            className="text-[11px] font-medium"
                            style={{ color: isToday ? 'var(--color-accent)' : 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
                          >
                            {dayHeading(iso)}
                          </span>
                          {/* Which day of the split this is — the 8-day cycle's
                              badge walks one weekday later each week. */}
                          <span
                            className="shrink-0 text-[10px] font-medium tabular-nums"
                            style={{ color: 'var(--color-accent-muted)' }}
                          >
                            D{cycleDay}
                          </span>
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

      {editingProgram && (
        <ProgramEditSheet
          program={program}
          onSave={(patch) => void api.updateProgram(program.id, patch)}
          onClose={() => setEditingProgram(false)}
        />
      )}

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
