import { useState } from 'react';
import { formatMoney, parseMoney, type BudgetGroup, type BudgetGroupOverride } from '../../types/budget';

interface Props {
  group: BudgetGroup;
  /** The group's DEFAULT monthly amount (what every un-overridden month uses). */
  defaultMonthly: number;
  /** This month's override row, or null when the default applies. */
  override: BudgetGroupOverride | null;
  monthLabel: string;
  onSetOverride: (amount: number, note?: string | null) => void;
  onClearOverride: () => void;
  onSetDueDay: (day: number | null) => void;
  onSetFloatSavings: (on: boolean) => void;
}

/** "1st", "2nd", "25th" … */
function ordinal(d: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = d % 100;
  return d + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/**
 * The expanded edit panel under a group's row: charge day, float savings, and a
 * one-month amount override.
 *
 * The charge day and the float toggle are both purely descriptive — neither
 * changes a weekly set-aside, which is always the flat monthly ÷ weeks split.
 * The override is the only control here that moves money.
 */
export default function GroupEditPanel({
  group,
  defaultMonthly,
  override,
  monthLabel,
  onSetOverride,
  onClearOverride,
  onSetDueDay,
  onSetFloatSavings,
}: Props) {
  const hasCharge = group.due_day != null;
  const floatOn = group.float_savings === true;
  const resolved = override ? Number(override.override_amount) || 0 : defaultMonthly;

  return (
    <div
      className="flex flex-col gap-4 border-t px-4 py-4"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-surface)' }}
    >
      {/* Charge day */}
      <label className="flex items-center gap-3">
        <span className="flex-1 text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
          Charge day
        </span>
        <select
          value={group.due_day ?? ''}
          onChange={(e) => onSetDueDay(e.target.value === '' ? null : Number(e.target.value))}
          className="w-36 shrink-0 rounded-xl border px-3 text-[15px] outline-none"
          style={{
            height: 44,
            background: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        >
          <option value="">None</option>
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {ordinal(d)}
            </option>
          ))}
        </select>
      </label>

      {/* Float savings — only meaningful once a charge day exists. */}
      {hasCharge && (
        <div>
          <button
            type="button"
            onClick={() => onSetFloatSavings(!floatOn)}
            aria-pressed={floatOn}
            className="flex w-full items-center gap-3 text-left"
          >
            <span className="flex-1 text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
              Float Savings
            </span>
            <span
              className="grid h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors"
              style={{ background: floatOn ? 'var(--color-accent)' : 'var(--color-border-strong)' }}
            >
              <span
                className="h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: floatOn ? 'translateX(16px)' : 'translateX(0)' }}
              />
            </span>
          </button>
          <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
            Marks the charge week in your paycheck view without changing your weekly
            set-aside amount
          </p>
        </div>
      )}

      {/* Monthly override */}
      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span className="text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
            Default: {formatMoney(defaultMonthly)}/mo
          </span>
          {override && (
            <span className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold" style={{ color: 'var(--color-warning)' }}>
                Override active
              </span>
              <button
                type="button"
                onClick={onClearOverride}
                aria-label={`Remove ${monthLabel} override`}
                className="grid h-6 w-6 place-items-center rounded-full"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          )}
        </div>
        <label className="flex items-center gap-3">
          <span className="flex-1 text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
            This month
          </span>
          <OverrideField
            value={resolved}
            isOverride={!!override}
            onSave={(n) => onSetOverride(n)}
          />
        </label>
        {override && (
          <input
            defaultValue={override.note ?? ''}
            placeholder="Add a note (e.g. 'Policy renewal')"
            aria-label="Override note"
            onBlur={(e) => {
              const note = e.target.value.trim();
              if (note !== (override.note ?? '')) {
                onSetOverride(Number(override.override_amount) || 0, note || null);
              }
            }}
            className="mt-2 w-full rounded-xl border px-3 text-[15px] outline-none"
            style={{
              height: 44,
              background: 'var(--color-bg-elevated)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
          />
        )}
        <p className="mt-1.5 text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
          Only changes {monthLabel} — every other month keeps the default.
        </p>
      </div>
    </div>
  );
}

/** The "This month" amount input. Editing it writes an override for the month. */
function OverrideField({
  value,
  isOverride,
  onSave,
}: {
  value: number;
  isOverride: boolean;
  onSave: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : formatMoney(value);
  return (
    <input
      inputMode="decimal"
      aria-label="Amount for this month"
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setText(value ? String(Math.round(value * 100) / 100) : '');
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = parseMoney(text);
        // Re-saving the same number would create a pointless override row.
        if (text.trim() !== '' && n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="w-36 shrink-0 rounded-xl border px-3 text-right text-[15px] font-semibold tabular-nums outline-none"
      style={{
        height: 44,
        background: 'var(--color-bg-elevated)',
        borderColor: isOverride ? 'var(--color-warning)' : 'var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}
