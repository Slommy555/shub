import { useState } from 'react';
import { formatMoney, parseMoney } from '../../types/budget';

interface Props {
  /** "July 2026" — the month in view. */
  monthLabel: string;
  /** Everything this month must fund, after savings earmarks. */
  totalNeeded: number;
  /** The manually-logged running total (budget_periods.amount_set_aside). */
  setAside: number;
  onSetAside: (n: number) => void;
  /** Thursdays in this calendar month. */
  weeks: number;
  /** 1-based index of the week containing today, clamped into [1, weeks]. */
  currentWeek: number;
  /** True when today actually falls inside the month in view. */
  isCurrentMonth: boolean;
}

/**
 * The running-total snapshot: how much has actually been set aside this month
 * against how much the month needs by its end.
 *
 * "Set aside so far" is hand-entered rather than derived — it's the one number
 * the app can't infer, because it means money the user really moved. Everything
 * else on the card is measured against it.
 */
export default function SetAsideSnapshot({
  monthLabel,
  totalNeeded,
  setAside,
  onSetAside,
  weeks,
  currentWeek,
  isCurrentMonth,
}: Props) {
  const remaining = totalNeeded - setAside;
  const onTrack = remaining <= 0;
  const pct = totalNeeded > 0 ? Math.min(100, (setAside / totalNeeded) * 100) : 0;

  // Weeks left INCLUDING the current one — this week's money hasn't been set
  // aside yet, so it still counts toward the pace.
  const weeksLeft = Math.max(1, weeks - currentWeek + 1);
  const perWeek = onTrack ? 0 : remaining / weeksLeft;

  return (
    <div
      className="mb-5 rounded-2xl border p-4 sm:p-5"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <h2
        className="text-[11px] font-semibold uppercase"
        style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
      >
        {monthLabel}
      </h2>

      {/* The two headline numbers */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <span className="block text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            Set aside so far
          </span>
          <span
            className="block text-2xl font-bold tabular-nums"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            {formatMoney(setAside)}
          </span>
        </div>
        <div>
          <span className="block text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            Needed by end of month
          </span>
          <span
            className="block text-2xl font-bold tabular-nums"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.03em' }}
          >
            {formatMoney(totalNeeded)}
          </span>
        </div>
      </div>

      {/* Progress. Capped at 100% width even when over-funded. */}
      <div
        className="mt-3 h-1.5 w-full overflow-hidden rounded"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        <div
          className="h-full rounded"
          style={{
            width: `${pct}%`,
            background: onTrack ? 'var(--color-success)' : 'var(--color-accent)',
            transition: 'width 200ms ease',
          }}
        />
      </div>

      {/* Remaining, or the on-track state */}
      <div className="mt-3 flex items-baseline justify-between gap-3">
        {onTrack ? (
          <span className="text-[15px] font-semibold" style={{ color: 'var(--color-success)' }}>
            On track ✓
          </span>
        ) : (
          <>
            <span className="text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
              Remaining to set aside
            </span>
            <span
              className="text-[17px] font-semibold tabular-nums"
              style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
            >
              {formatMoney(remaining)}
            </span>
          </>
        )}
      </div>

      {/* Week pace. Only meaningful while the month is actually running. */}
      {isCurrentMonth && (
        <p className="mt-1.5 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
          Week {currentWeek} of {weeks} this month
          {!onTrack && ` · ${formatMoney(perWeek)}/week to stay on track`}
        </p>
      )}

      {/* The hand-logged input */}
      <label className="mt-4 flex items-center gap-3">
        <span className="shrink-0 text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
          I've set aside
        </span>
        <SetAsideField value={setAside} onSave={onSetAside} />
      </label>
    </div>
  );
}

/** Currency input showing the raw number while focused, formatted on blur. */
function SetAsideField({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';
  return (
    <input
      inputMode="decimal"
      placeholder="$0"
      aria-label="Amount set aside so far this month"
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setText(value ? String(value) : '');
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = parseMoney(text);
        if (n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="min-w-0 flex-1 rounded-xl border px-3 text-right text-[17px] font-semibold tabular-nums outline-none"
      style={{
        height: 48,
        background: 'var(--color-bg-surface)',
        borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}
