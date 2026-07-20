import { useState } from 'react';
import { formatMoney, parseMoney, type BudgetGroup } from '../../types/budget';

interface Props {
  groups: BudgetGroup[];
  /** Weekly income from the Overview — used only to pre-fill the field. */
  seedIncome: number;
  /** The amount to set aside for a group from one paycheck (its weekly amount). */
  weeklyOf: (g: BudgetGroup) => number;
}

/**
 * Paycheck view: a single-paycheck waterfall. Each group card shows how much to
 * set aside (its weekly amount) and the running remainder of the paycheck after
 * that group and everything above it. The income field is seeded from the
 * Overview's weekly income but edited locally — changing it here never touches
 * the Overview.
 */
export default function PaycheckList({ groups, seedIncome, weeklyOf }: Props) {
  // null → still tracking the seeded weekly income; a number → user overrode it.
  const [override, setOverride] = useState<number | null>(null);
  const income = override ?? seedIncome;

  const totalSetAside = groups.reduce((sum, g) => sum + weeklyOf(g), 0);
  const leftOver = income - totalSetAside;

  let running = income;

  return (
    <div>
      {/* Paycheck income */}
      <PaycheckIncomeField value={income} onSave={setOverride} />

      {/* Group waterfall */}
      {groups.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-2xl border px-4 py-10 text-center text-[15px]"
          style={{
            background: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border)',
            color: 'var(--color-text-tertiary)',
          }}
        >
          No expense groups yet
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g) => {
            const setAside = weeklyOf(g);
            running -= setAside;
            const remainingAfter = running;
            return (
              <div
                key={g.id}
                className="rounded-2xl border p-4"
                style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                  <span
                    className="min-w-0 flex-1 truncate text-[15px] font-medium"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {g.name}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Set aside
                    </span>
                    <span
                      className="text-lg font-semibold tabular-nums"
                      style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
                    >
                      {formatMoney(setAside)}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      Remaining after
                    </span>
                    <span
                      className="text-lg font-semibold tabular-nums"
                      style={{
                        color: remainingAfter >= 0 ? 'var(--color-text-primary)' : 'var(--color-danger)',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {formatMoney(remainingAfter)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      <div
        className="mt-4 rounded-2xl border p-4"
        style={{ background: 'var(--color-bg-overlay)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center justify-between py-1">
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Total to set aside
          </span>
          <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
            {formatMoney(totalSetAside)}
          </span>
        </div>
        <div
          className="mt-2 flex items-center justify-between border-t pt-3"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Left over
          </span>
          <span
            className="text-xl font-bold tabular-nums"
            style={{
              color: leftOver >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
              letterSpacing: '-0.02em',
            }}
          >
            {formatMoney(leftOver)}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Large currency input for the current paycheck (raw while focused). */
function PaycheckIncomeField({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';
  return (
    <div className="mb-5">
      <label
        htmlFor="paycheck-income"
        className="mb-2 block text-sm font-medium"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        Current paycheck income
      </label>
      <input
        id="paycheck-income"
        inputMode="decimal"
        placeholder="$0"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setText(value ? String(value) : '');
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          onSave(parseMoney(text));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-xl border px-4 text-2xl font-bold tabular-nums outline-none"
        style={{
          height: '56px',
          background: 'var(--color-bg-surface)',
          borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}
