import { useRef, useState } from 'react';
import type { TemplateWithExercises } from '../../../types/workout';
import type { UsePrograms } from '../../../hooks/workout/usePrograms';
import { parseISO, todayISO } from '../../../lib/dates';
import ProgramDetail from './ProgramDetail';
import Sheet from './Sheet';

const LONG_PRESS_MS = 550;

const inputStyle: React.CSSProperties = {
  height: 48,
  background: 'var(--color-bg-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="mb-1.5 block text-[11px] font-medium uppercase"
      style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
    >
      {children}
    </span>
  );
}

/** The New Program bottom sheet: name, start date, weeks, 7/8-day cycle. */
function NewProgramSheet({
  onCreate,
  onClose,
}: {
  onCreate: (input: { name: string; start_date: string; total_weeks: number; cycle_length: number }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [weeks, setWeeks] = useState('12');
  const [cycle, setCycle] = useState<7 | 8>(7);

  return (
    <Sheet title="New program" onClose={onClose}>
      <label className="mb-4 block">
        <Label>Name</Label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Winter Hypertrophy"
          className="w-full rounded-xl border px-4 text-[15px] outline-none"
          style={inputStyle}
        />
      </label>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block">
          <Label>Start date</Label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-xl border px-3 text-[15px] outline-none"
            style={inputStyle}
          />
        </label>
        <label className="block">
          <Label>Total weeks</Label>
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

      <div className="mb-5">
        <Label>Cycle length</Label>
        <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg-surface)' }}>
          {([7, 8] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setCycle(n)}
              aria-pressed={cycle === n}
              className="flex-1 rounded-xl py-2.5 text-[13px] font-semibold"
              style={
                cycle === n
                  ? { background: 'var(--color-accent)', color: 'var(--color-accent-text)' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              {n} days
            </button>
          ))}
        </div>
        {cycle === 8 && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            Weeks stay 7 days. An 8-day split isn't tied to weekdays, so Day 1–8 drift one weekday
            later each week and any given week shows 7 of the 8.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onCreate({
            name,
            start_date: startDate || todayISO(),
            total_weeks: Number(weeks) || 12,
            cycle_length: cycle,
          });
          onClose();
        }}
        className="w-full rounded-full text-[15px] font-semibold active:scale-[0.98] active:opacity-85"
        style={{ height: 52, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
      >
        Create
      </button>
    </Sheet>
  );
}

/**
 * The Program sub-tab: a list of training blocks, or one program's calendar when
 * you tap into it. Long-pressing a row (or the ⋯ button on desktop) deletes it.
 */
export default function ProgramTab({
  api,
  templates,
}: {
  api: UsePrograms;
  templates: TemplateWithExercises[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressed = useRef(false);

  const open = openId ? api.programs.find((p) => p.id === openId) ?? null : null;
  if (open) {
    return (
      <div className="ui-scope" style={{ background: 'var(--color-bg-base)' }}>
        <ProgramDetail
          program={open}
          api={api}
          templates={templates}
          onBack={() => setOpenId(null)}
        />
      </div>
    );
  }

  function confirmDelete(id: string, name: string) {
    if (window.confirm(`Delete "${name}"? This removes the program and all of its weeks.`)) {
      void api.deleteProgram(id);
    }
  }

  function startPress(id: string, name: string) {
    longPressed.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      confirmDelete(id, name);
    }, LONG_PRESS_MS);
  }

  function endPress() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  return (
    <div className="ui-scope min-h-screen" style={{ background: 'var(--color-bg-base)' }}>
      <div className="pb-fab mx-auto w-full max-w-app px-4 py-5 sm:px-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
              Programs
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
              A repeating split, run for a set number of weeks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-full px-4 text-[13px] font-semibold active:scale-[0.98] active:opacity-85"
            style={{ height: 44, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
          >
            New Program
          </button>
        </div>

        {api.loading ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-20 rounded-2xl" />
            ))}
          </div>
        ) : api.programs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ color: 'var(--color-text-tertiary)' }}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p className="mt-4 text-[17px]" style={{ color: 'var(--color-text-secondary)' }}>
              No programs yet
            </p>
            <p className="mt-1 max-w-xs text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Create one to plan a training block, mark deload weeks, and drive the Home screen.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {api.programs.map((p) => (
              <div
                key={p.id}
                className="relative flex items-center gap-3 rounded-2xl border px-4 py-3"
                style={{
                  minHeight: 64,
                  background: 'var(--color-bg-elevated)',
                  borderColor: p.is_active ? 'var(--color-accent-muted)' : 'var(--color-border)',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (longPressed.current) return;
                    setOpenId(p.id);
                  }}
                  onPointerDown={() => startPress(p.id, p.name)}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onPointerCancel={endPress}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    confirmDelete(p.id, p.name);
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className="min-w-0 truncate text-[17px] font-medium"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {p.name}
                      </span>
                      {p.is_active && (
                        <span
                          className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          style={{ background: 'var(--color-accent-subtle)', color: 'var(--color-accent)', letterSpacing: '0.02em' }}
                        >
                          Active
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                      {p.cycle_length}-day cycle · {p.total_weeks} weeks · from{' '}
                      {parseISO(p.start_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0" style={{ color: 'var(--color-text-tertiary)' }}>
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {creating && (
          <NewProgramSheet
            onCreate={(input) => void api.createProgram(input)}
            onClose={() => setCreating(false)}
          />
        )}
      </div>
    </div>
  );
}
