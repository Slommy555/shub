import { useState } from 'react';
import { formatMoney, parseMoney, type BudgetGroup } from '../../types/budget';

/** A compact money input that shows the raw number while editing, formats on blur. */
function MoneyInput({
  value,
  onSave,
  placeholder = '$0.00',
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
  groups: BudgetGroup[];
  totalSaved: number;
  earmarkAmounts: Record<string, number>;
  allocated: number;
  remaining: number;
  onSetTotal: (n: number) => void;
  onSetEarmark: (groupId: string, n: number) => void;
}

/**
 * Savings Pool: a set-aside amount plus per-group earmarks. Collapsed by default,
 * showing the amount available. Earmarks can't exceed the pool total — an attempt
 * to over-allocate is capped and flagged.
 */
export default function SavingsPoolSection({
  groups,
  totalSaved,
  earmarkAmounts,
  allocated,
  remaining,
  onSetTotal,
  onSetEarmark,
}: Props) {
  const [open, setOpen] = useState(false);
  const [warnId, setWarnId] = useState<string | null>(null);

  const commitEarmark = (groupId: string, entered: number) => {
    const others = allocated - (earmarkAmounts[groupId] ?? 0);
    const maxForThis = Math.max(0, totalSaved - others);
    if (entered > maxForThis) {
      setWarnId(groupId);
      onSetEarmark(groupId, maxForThis);
    } else {
      setWarnId(null);
      onSetEarmark(groupId, entered);
    }
  };

  return (
    <div
      className="mt-6 rounded-2xl border"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-4 text-left"
      >
        <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Savings Pool
        </span>
        <span className="flex items-center gap-2">
          <span className="text-sm tabular-nums" style={{ color: 'var(--color-success)' }}>
            {formatMoney(remaining)} available
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
              Total set aside
            </span>
            <div className="flex justify-start">
              <MoneyInput value={totalSaved} onSave={(n) => onSetTotal(n)} />
            </div>
          </label>

          {groups.length > 0 && (
            <>
              <span className="mb-2 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Earmark toward groups
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
                      <MoneyInput
                        value={earmarkAmounts[g.id] ?? 0}
                        onSave={(n) => commitEarmark(g.id, n)}
                      />
                    </div>
                    {warnId === g.id && (
                      <p className="mt-1 text-right text-[12px]" style={{ color: 'var(--color-danger)' }}>
                        Exceeds available savings pool
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
              Allocated <span style={{ color: 'var(--color-text-primary)' }}>{formatMoney(allocated)}</span>
            </span>
            <span style={{ color: 'var(--color-text-secondary)' }}>
              Remaining <span style={{ color: 'var(--color-text-primary)' }}>{formatMoney(remaining)}</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
