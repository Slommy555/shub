import { useState } from 'react';
import type { TemplateWithExercises } from '../../../types/workout';
import Sheet from './Sheet';

export interface DayDraft {
  /** Every workout on the day, in the order they're meant to be done. */
  template_ids: string[];
  label: string | null;
  is_rest: boolean;
}

const ADD = '__add__';

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

/** Square icon button used for the reorder arrows and the remove x. */
function RowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid h-9 w-8 shrink-0 place-items-center rounded-lg active:opacity-70 disabled:opacity-25"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {children}
    </button>
  );
}

/**
 * The day editor. The same sheet edits either the DEFAULT split (applies to
 * every week that hasn't been changed) or one specific week — `scopeNote` says
 * which, and `onReset` is only offered when a week override is in force.
 *
 * A day can hold several workouts: they're listed in the order you'll do them,
 * and the same template may appear twice (two sessions of the same thing is a
 * real plan, so nothing dedupes the list).
 */
export default function DayEditSheet({
  title,
  scopeNote,
  templates,
  value,
  onSave,
  onReset,
  onClose,
}: {
  title: string;
  scopeNote: string;
  templates: TemplateWithExercises[];
  value: DayDraft;
  onSave: (draft: DayDraft) => void;
  /** Present only when editing a week that currently overrides the default. */
  onReset?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DayDraft>(value);

  const nameOf = (id: string) => templates.find((t) => t.id === id)?.name ?? 'Deleted template';
  const setIds = (ids: string[]) => setDraft((d) => ({ ...d, template_ids: ids }));

  function addTemplate(id: string) {
    // Adding a workout to a rest day is the clearest possible signal it isn't
    // one any more, so clear the flag rather than making them un-toggle it.
    setDraft((d) => ({ ...d, is_rest: false, template_ids: [...d.template_ids, id] }));
  }

  function removeAt(i: number) {
    setIds(draft.template_ids.filter((_, j) => j !== i));
  }

  function moveBy(i: number, delta: number) {
    const to = i + delta;
    if (to < 0 || to >= draft.template_ids.length) return;
    const next = [...draft.template_ids];
    [next[i], next[to]] = [next[to], next[i]];
    setIds(next);
  }

  function toggleRest() {
    // Marking a rest day drops its workouts — a rest day with a workout on it is
    // a contradiction, and hiding them would resurrect them on un-toggle.
    setDraft((d) =>
      d.is_rest ? { ...d, is_rest: false } : { ...d, is_rest: true, template_ids: [] }
    );
  }

  const count = draft.template_ids.length;

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-4 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {scopeNote}
      </p>

      <div className="mb-4">
        <FieldLabel>Workouts</FieldLabel>

        {draft.is_rest ? (
          <p
            className="rounded-xl border px-4 py-3 text-[13px]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
          >
            Rest day — no workouts scheduled.
          </p>
        ) : count === 0 ? (
          <p
            className="rounded-xl border px-4 py-3 text-[13px]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
          >
            No workouts yet. Add one below, or leave it empty for a label-only day.
          </p>
        ) : (
          <ol className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--color-border)' }}>
            {draft.template_ids.map((id, i) => (
              <li
                key={`${id}-${i}`}
                className="flex items-center gap-1 px-2 py-1.5"
                style={{
                  background: 'var(--color-bg-surface)',
                  borderTop: i === 0 ? undefined : '1px solid var(--color-border)',
                }}
              >
                <span
                  className="w-5 shrink-0 text-center text-[12px] font-medium tabular-nums"
                  style={{ color: 'var(--color-text-tertiary)' }}
                >
                  {i + 1}
                </span>
                <span
                  className="min-w-0 flex-1 truncate text-[15px]"
                  style={{ color: 'var(--color-text-primary)' }}
                >
                  {nameOf(id)}
                </span>
                <RowButton label={`Move ${nameOf(id)} up`} onClick={() => moveBy(i, -1)} disabled={i === 0}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 15-6-6-6 6" />
                  </svg>
                </RowButton>
                <RowButton label={`Move ${nameOf(id)} down`} onClick={() => moveBy(i, 1)} disabled={i === count - 1}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </RowButton>
                <RowButton label={`Remove ${nameOf(id)}`} onClick={() => removeAt(i)}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </RowButton>
              </li>
            ))}
          </ol>
        )}

        {/* Snaps back to the placeholder after each pick, so it reads as an
            action rather than a selection that is now "current". */}
        <select
          value={ADD}
          onChange={(e) => {
            if (e.target.value !== ADD) addTemplate(e.target.value);
          }}
          aria-label="Add a workout to this day"
          className="mt-2 w-full rounded-xl border px-3 text-[15px] outline-none"
          style={inputStyle}
        >
          <option value={ADD}>{count === 0 ? '+ Add a workout…' : '+ Add another workout…'}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>

        {count > 1 && (
          <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {count} workouts on this day — you start them one at a time, in this order.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={toggleRest}
        aria-pressed={draft.is_rest}
        className="mb-4 flex w-full items-center justify-between rounded-xl border px-4 py-3 text-[15px] active:opacity-80"
        style={{
          borderColor: draft.is_rest ? 'transparent' : 'var(--color-border)',
          background: draft.is_rest ? 'var(--color-accent-subtle)' : 'transparent',
          color: draft.is_rest ? 'var(--color-accent)' : 'var(--color-text-primary)',
        }}
      >
        <span>Rest day</span>
        <span
          className="grid h-6 w-6 place-items-center rounded-md border text-[13px]"
          style={{
            borderColor: draft.is_rest ? 'var(--color-accent)' : 'var(--color-border-strong)',
            color: draft.is_rest ? 'var(--color-accent)' : 'transparent',
          }}
        >
          ✓
        </span>
      </button>

      <label className="mb-5 block">
        <FieldLabel>Label</FieldLabel>
        <input
          type="text"
          value={draft.label ?? ''}
          onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value || null }))}
          placeholder={draft.is_rest ? 'Rest' : 'e.g. Push A'}
          className="w-full rounded-xl border px-4 text-[15px] outline-none"
          style={inputStyle}
        />
      </label>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
          className="w-full rounded-full text-[15px] font-semibold active:scale-[0.98] active:opacity-85"
          style={{ height: 52, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
        >
          Save
        </button>
        {onReset && (
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="w-full rounded-full border text-[15px] font-semibold"
            style={{
              height: 52,
              background: 'transparent',
              borderColor: 'var(--color-border-strong)',
              color: 'var(--color-text-secondary)',
            }}
          >
            Reset to default split
          </button>
        )}
      </div>
    </Sheet>
  );
}
