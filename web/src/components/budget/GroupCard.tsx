import { useEffect, useState } from 'react';
import { creditCardWeekly, formatMoney, parseMoney, PRESET_COLORS, type BudgetGroup } from '../../types/budget';

/** A whole-number field (used for the number of weeks to pay a card off). */
function IntField({ label, value, onSave }: { label: string; value: number; onSave: (n: number) => void }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const display = focused ? text : value ? String(value) : '';
  return (
    <label className="flex-1">
      <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <input
        data-no-drag
        inputMode="numeric"
        placeholder="0"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setText(value ? String(value) : '');
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const n = Math.max(0, Math.floor(Number(text.replace(/[^0-9]/g, '')) || 0));
          if (n !== value) onSave(n);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-xl border px-3 text-base tabular-nums outline-none"
        style={{ height: '48px', background: 'var(--color-bg-surface)', borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)', color: 'var(--color-text-primary)' }}
      />
    </label>
  );
}

/** A native date field for the credit-card due date (saves on change). */
function DateField({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Due date
      </span>
      <input
        data-no-drag
        type="date"
        value={value ?? ''}
        onChange={(e) => onSave(e.target.value || null)}
        className="w-full rounded-xl border px-3 text-base outline-none"
        style={{ height: '48px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
      />
    </label>
  );
}

/** Text field for renaming a group (saves on blur / Enter, reverts if emptied). */
function NameField({ value, onSave }: { value: string; onSave: (s: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setText(value);
  };

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        Name
      </span>
      <input
        data-no-drag
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-xl border px-3 text-base outline-none"
        style={{
          height: '48px',
          background: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </label>
  );
}

/** A single money field used inside the inline edit panel (saves on blur). */
function MoneyField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';

  return (
    <label className="flex-1">
      <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <input
        data-no-drag
        inputMode="decimal"
        placeholder="$0.00"
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
        className="w-full rounded-xl border px-3 text-base tabular-nums outline-none"
        style={{
          height: '48px',
          background: 'var(--color-bg-surface)',
          borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </label>
  );
}

/** Piggy-bank glyph shown when a group is offset by savings. */
function PiggyBank() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden="true"
    >
      <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.4-1.5 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
      <path d="M2 9v1c0 1.1.9 2 2 2h1" />
      <path d="M16 11h0" />
    </svg>
  );
}

/** Credit-card glyph for credit-card payoff groups. */
function CreditCardIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

interface GroupCardProps {
  group: BudgetGroup;
  amount: number; // this period's allocated amount (or the monthly roll-up)
  amountLabel: string;
  /** per-week items are read-only on the monthly view (summed) */
  amountReadOnly?: boolean;
  /** how much of the savings pool is earmarked toward this group */
  earmark: number;
  expanded: boolean;
  swipeX: number; // 0 or negative (swiped left)
  dragging: boolean;
  onHeaderPointerDown: (e: React.PointerEvent) => void;
  onChangeAmount: (n: number) => void;
  onChangeName: (name: string) => void;
  onChangeColor: (color: string) => void;
  onTogglePersistent: (persistent: boolean) => void;
  onToggleCredit: (isCredit: boolean) => void;
  onChangeCredit: (patch: { cc_total?: number; cc_weeks?: number; cc_due_date?: string | null }) => void;
  onDelete: () => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}

export default function GroupCard({
  group,
  amount,
  amountLabel,
  amountReadOnly = false,
  earmark,
  expanded,
  swipeX,
  dragging,
  onHeaderPointerDown,
  onChangeAmount,
  onChangeName,
  onChangeColor,
  onTogglePersistent,
  onToggleCredit,
  onChangeCredit,
  onDelete,
  rowRef,
}: GroupCardProps) {
  const hasEarmark = earmark > 0;
  const fromIncome = Math.max(0, amount - earmark);
  const isCredit = group.kind === 'credit_card';
  const ccWeekly = creditCardWeekly(group.cc_total, group.cc_weeks);
  const ccDueLabel = group.cc_due_date
    ? new Date(group.cc_due_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;
  return (
    <div ref={rowRef} className="relative mb-2 select-none">
      {/* Delete button behind the card, revealed on swipe-left */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          data-no-drag
          type="button"
          onClick={onDelete}
          className="flex h-full items-center rounded-2xl px-5 text-sm font-semibold"
          style={{ background: 'var(--color-danger)', color: '#fff' }}
        >
          Delete
        </button>
      </div>

      {/* Foreground card */}
      <div
        className="relative rounded-2xl border"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: dragging ? 'none' : 'transform 160ms ease',
          background: 'var(--color-bg-elevated)',
          borderColor: dragging ? 'var(--color-border-strong)' : 'var(--color-border)',
          boxShadow: dragging ? '0 8px 24px rgba(0,0,0,0.4)' : 'none',
          opacity: dragging ? 0.96 : 1,
        }}
      >
        {/* Header (gesture surface: tap = expand, long-press = reorder, swipe = delete) */}
        <div
          onPointerDown={onHeaderPointerDown}
          className="flex items-center gap-3 px-4 py-4"
          style={{ touchAction: 'pan-y', cursor: dragging ? 'grabbing' : 'pointer' }}
        >
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: group.color }} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {group.name}
            </span>
            {isCredit && ccWeekly > 0 && (
              <span className="mt-0.5 flex items-center gap-1 truncate text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                <CreditCardIcon />
                {formatMoney(ccWeekly)}/wk{ccDueLabel ? ` · due ${ccDueLabel}` : ''}
              </span>
            )}
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
              {formatMoney(amount)}
            </span>
            {hasEarmark && (
              <>
                <span
                  className="mt-0.5 flex items-center gap-1 text-[12px] tabular-nums"
                  style={{ color: 'var(--color-success)' }}
                >
                  <PiggyBank />
                  {formatMoney(earmark)} from savings
                </span>
                <span className="text-[12px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                  {formatMoney(fromIncome)} from income
                </span>
              </>
            )}
          </span>
        </div>

        {/* Inline edit panel */}
        {expanded && (
          <div className="flex flex-col gap-3 border-t px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <NameField value={group.name} onSave={onChangeName} />

            <div>
              <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                Color
              </span>
              <div className="flex flex-wrap gap-2.5" data-no-drag>
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    data-no-drag
                    type="button"
                    onClick={() => onChangeColor(c)}
                    aria-label={`Choose color ${c}`}
                    aria-pressed={group.color === c}
                    className="h-9 w-9 rounded-full transition-transform active:scale-95"
                    style={{
                      background: c,
                      outline: group.color === c ? '2px solid var(--color-text-primary)' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Credit-card payoff toggle */}
            <button
              data-no-drag
              type="button"
              onClick={() => onToggleCredit(!isCredit)}
              className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-left"
              style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
            >
              <span className="min-w-0 pr-3">
                <span className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  Credit card payoff
                </span>
                <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  Split a balance into weekly payments before a due date
                </span>
              </span>
              <span
                className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
                style={{ background: isCredit ? 'var(--color-accent)' : 'var(--color-border-strong)' }}
              >
                <span
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                  style={{ transform: isCredit ? 'translateX(18px)' : 'translateX(2px)' }}
                />
              </span>
            </button>

            {isCredit ? (
              <>
                <DateField value={group.cc_due_date} onSave={(v) => onChangeCredit({ cc_due_date: v })} />
                <div className="flex gap-3">
                  <MoneyField label="Amount owed" value={group.cc_total} onSave={(n) => onChangeCredit({ cc_total: n })} />
                  <IntField label="Weeks" value={group.cc_weeks} onSave={(n) => onChangeCredit({ cc_weeks: n })} />
                </div>
                <div
                  className="flex items-center justify-between rounded-xl border px-3 py-3"
                  style={{ background: 'var(--color-accent-subtle)', borderColor: 'var(--color-border)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Weekly payment
                  </span>
                  <span className="text-base font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    {formatMoney(ccWeekly)}/wk
                  </span>
                </div>
              </>
            ) : (
              <>
                {/* Persistent toggle: recurring fixed amount vs entered per week */}
                <button
                  data-no-drag
                  type="button"
                  onClick={() => onTogglePersistent(!group.persistent)}
                  className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-left"
                  style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
                >
                  <span className="min-w-0 pr-3">
                    <span className="block text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Repeats every period
                    </span>
                    <span className="block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {group.persistent
                        ? 'Fixed recurring amount (e.g. Rent) — set it in any view'
                        : 'Entered per week; the month adds up its weeks'}
                    </span>
                  </span>
                  <span
                    className="relative h-6 w-10 shrink-0 rounded-full transition-colors"
                    style={{ background: group.persistent ? 'var(--color-accent)' : 'var(--color-border-strong)' }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                      style={{ transform: group.persistent ? 'translateX(18px)' : 'translateX(2px)' }}
                    />
                  </span>
                </button>

                {amountReadOnly ? (
                  <label className="block">
                    <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                      {amountLabel}
                    </span>
                    <div
                      className="flex w-full items-center rounded-xl border px-3 text-base tabular-nums"
                      style={{
                        height: '48px',
                        background: 'var(--color-bg-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      {formatMoney(amount)}
                    </div>
                  </label>
                ) : (
                  <MoneyField label={amountLabel} value={amount} onSave={onChangeAmount} />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
