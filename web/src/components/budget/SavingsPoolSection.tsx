import { useState } from 'react';
import { formatMoney, parseMoney, type BudgetGroup } from '../../types/budget';

/** A compact money input that shows the raw number while editing, formats on blur. */
function MoneyInput({
  value,
  onSave,
  placeholder = '$0',
}: {
  value: number;
  onSave: (n: number) => void;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';

  return (
    <input
      inputMode="decimal"
      placeholder={placeholder}
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
      className="w-32 rounded-xl border px-3 text-right text-base tabular-nums outline-none"
      style={{
        height: '44px',
        background: 'var(--color-bg-surface)',
        borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}

interface Props {
  /** Groups you can earmark savings toward (excludes the Savings category). */
  groups: BudgetGroup[];
  hasSavingsCategory: boolean;
  /** The monthly "Savings" category amount. */
  monthlyContribution: number;
  /** How many months of contributions are counted through the selected month. */
  monthsCounted: number;
  startMonthLabel: string;
  startingBalance: number;
  onSetStartingBalance: (n: number) => void;
  /** starting + contributions − allocations from previous months. */
  available: number;
  /** This month's earmarks (drawn from `available`). */
  allocated: number;
  earmarkAmounts: Record<string, number>;
  onSetEarmark: (groupId: string, n: number) => void;
}

/**
 * Savings account box: a running balance that grows by the monthly "Savings"
 * category and is drawn down as you allocate savings toward expenses. The
 * balance carries across months; only the starting point is stored.
 */
export default function SavingsPoolSection({
  groups,
  hasSavingsCategory,
  monthlyContribution,
  monthsCounted,
  startMonthLabel,
  startingBalance,
  onSetStartingBalance,
  available,
  allocated,
  earmarkAmounts,
  onSetEarmark,
}: Props) {
  const [open, setOpen] = useState(false);
  const [warnId, setWarnId] = useState<string | null>(null);

  const contributions = monthlyContribution * monthsCounted;
  const balance = available - allocated;

  const commitEarmark = (groupId: string, entered: number) => {
    const others = allocated - (earmarkAmounts[groupId] ?? 0);
    const maxForThis = Math.max(0, available - others);
    if (entered > maxForThis) {
      setWarnId(groupId);
      onSetEarmark(groupId, maxForThis);
    } else {
      setWarnId(null);
      onSetEarmark(groupId, entered);
    }
  };

  const Line = ({ label, value, strong }: { label: string; value: string; strong?: boolean }) => (
    <div className="flex items-center justify-between text-sm tabular-nums">
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span
        style={{ color: strong ? 'var(--color-text-primary)' : 'var(--color-text-secondary)', fontWeight: strong ? 600 : 400 }}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Savings account
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm tabular-nums" style={{ color: 'var(--color-success)' }}>
            {formatMoney(balance)}
          </span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-text-secondary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="border-t px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
              Starting balance (as of {startMonthLabel})
            </span>
            <div className="flex justify-start">
              <MoneyInput value={startingBalance} onSave={onSetStartingBalance} />
            </div>
          </label>

          {/* Balance breakdown */}
          <div className="mb-4 flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-surface)' }}>
            <Line label="Starting balance" value={formatMoney(startingBalance)} />
            <Line
              label={
                hasSavingsCategory
                  ? `+ Savings budgeted (${monthsCounted} mo × ${formatMoney(monthlyContribution)})`
                  : '+ Savings budgeted'
              }
              value={formatMoney(contributions)}
            />
            <Line label="− Allocated to date" value={formatMoney(startingBalance + contributions - balance)} />
            <div className="mt-1 border-t pt-2" style={{ borderColor: 'var(--color-border)' }}>
              <Line label="Balance" value={formatMoney(balance)} strong />
            </div>
          </div>

          {!hasSavingsCategory && (
            <p className="mb-4 text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Add an expense group named “Savings” to contribute to this balance every month.
            </p>
          )}

          {groups.length > 0 && (
            <>
              <span className="mb-2 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Allocate savings this month toward
              </span>
              <div className="flex flex-col gap-2">
                {groups.map((g) => (
                  <div key={g.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
                        <span className="truncate text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
                          {g.name}
                        </span>
                      </span>
                      <MoneyInput value={earmarkAmounts[g.id] ?? 0} onSave={(n) => commitEarmark(g.id, n)} />
                    </div>
                    {warnId === g.id && (
                      <p className="mt-1 text-right text-[12px]" style={{ color: 'var(--color-danger)' }}>
                        Exceeds available savings balance
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          <div
            className="mt-4 flex items-center justify-between border-t pt-3 text-sm tabular-nums"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Allocated this month <span style={{ color: 'var(--color-text-primary)' }}>{formatMoney(allocated)}</span>
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Balance <span style={{ color: 'var(--color-text-primary)' }}>{formatMoney(balance)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
