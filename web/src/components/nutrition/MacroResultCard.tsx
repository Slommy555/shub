import { useId, useRef, type ReactNode } from 'react';
import type { Macros } from '../../types/nutrition';

export interface MacroDraft extends Macros {
  food_name: string;
}

const FIELDS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
];

interface Props {
  draft: MacroDraft;
  onChange: (next: MacroDraft) => void;
  /** The free text the user typed for how much they ate. Static. */
  serving: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  /** Amber caveat from the scan (low confidence or a note), if any. */
  warning?: string | null;
  /** Rendered to the left of the primary button (e.g. Cancel). */
  secondary?: ReactNode;
  /**
   * Show an "Edit" button beside the primary action. The fields are always
   * editable — this just advertises that, and jumps focus to the food name.
   */
  showEdit?: boolean;
}

/**
 * The editable macro card — used both for a fresh scan result and, inside a
 * bottom sheet, for editing an entry that's already logged. Every value is
 * editable from the moment it appears; the "Edit" affordance beside the primary
 * button only exists to make that obvious.
 */
export default function MacroResultCard({
  draft,
  onChange,
  serving,
  primaryLabel,
  onPrimary,
  warning,
  secondary,
  showEdit,
}: Props) {
  const uid = useId();
  const nameRef = useRef<HTMLInputElement>(null);

  const setNum = (key: keyof Macros, raw: string) => {
    const n = raw === '' ? 0 : parseFloat(raw);
    onChange({ ...draft, [key]: Number.isFinite(n) && n >= 0 ? n : 0 });
  };

  return (
    <div>
      <div
        className="rounded-2xl border p-4 sm:p-5"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
      >
        <input
          ref={nameRef}
          value={draft.food_name}
          onChange={(e) => onChange({ ...draft, food_name: e.target.value })}
          placeholder="Food name"
          aria-label="Food name"
          className="w-full rounded-xl border px-3 py-2.5 text-[17px] font-semibold outline-none"
          style={{
            background: 'var(--color-bg-surface)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
            minHeight: 44,
          }}
        />

        {serving && (
          <p className="mt-2 text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Serving: {serving}
          </p>
        )}

        <div className="mt-4 space-y-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <label
                htmlFor={`${uid}-${f.key}`}
                className="flex-1 text-[15px]"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {f.label}
              </label>
              <div className="relative w-32 shrink-0">
                <input
                  id={`${uid}-${f.key}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={String(draft[f.key])}
                  onChange={(e) => setNum(f.key, e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full rounded-xl border px-3 text-right text-[15px] font-semibold tabular-nums outline-none"
                  style={{
                    background: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                    height: 44,
                    paddingRight: f.unit ? 26 : 12,
                  }}
                />
                {f.unit && (
                  <span
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {f.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-3">
          {showEdit && (
            <button
              type="button"
              onClick={() => {
                nameRef.current?.focus();
                nameRef.current?.select();
              }}
              className="rounded-full border px-5 text-[13px] font-semibold"
              style={{
                borderColor: 'var(--color-border-strong)',
                color: 'var(--color-text-secondary)',
                height: 48,
              }}
            >
              Edit
            </button>
          )}
          {secondary}
          <button
            type="button"
            onClick={onPrimary}
            className="flex-1 rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98]"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
              height: 48,
            }}
          >
            {primaryLabel}
          </button>
        </div>
      </div>

      {warning && (
        <p className="mt-2 px-1 text-[13px]" style={{ color: 'var(--color-warning)' }}>
          {warning}
        </p>
      )}
    </div>
  );
}
