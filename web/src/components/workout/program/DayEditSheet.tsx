import { useState } from 'react';
import type { TemplateWithExercises } from '../../../types/workout';
import Sheet from './Sheet';

export interface DayDraft {
  template_id: string | null;
  label: string | null;
  is_rest: boolean;
}

const REST = '__rest__';
const NONE = '__none__';

const inputStyle: React.CSSProperties = {
  height: 48,
  background: 'var(--color-bg-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

/**
 * The day editor. The same sheet edits either the DEFAULT split (applies to
 * every week that hasn't been changed) or one specific week — `scopeNote` says
 * which, and `onReset` is only offered when a week override is in force.
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

  const selectValue = draft.is_rest ? REST : (draft.template_id ?? NONE);

  function onSelect(choice: string) {
    if (choice === REST) setDraft((d) => ({ ...d, is_rest: true, template_id: null }));
    else if (choice === NONE) setDraft((d) => ({ ...d, is_rest: false, template_id: null }));
    else setDraft((d) => ({ ...d, is_rest: false, template_id: choice }));
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <p className="mb-4 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
        {scopeNote}
      </p>

      <label className="mb-4 block">
        <span
          className="mb-1.5 block text-[11px] font-medium uppercase"
          style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
        >
          Template
        </span>
        <select
          value={selectValue}
          onChange={(e) => onSelect(e.target.value)}
          className="w-full rounded-xl border px-3 text-[15px] outline-none"
          style={inputStyle}
        >
          <option value={REST}>Rest day</option>
          <option value={NONE}>No template (label only)</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mb-5 block">
        <span
          className="mb-1.5 block text-[11px] font-medium uppercase"
          style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
        >
          Label
        </span>
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
