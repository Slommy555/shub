import { useState } from 'react';
import { formatMoney, parseMoney, type BudgetAllocation, type BudgetGroup } from '../../types/budget';

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

interface GroupCardProps {
  group: BudgetGroup;
  allocation?: BudgetAllocation;
  expanded: boolean;
  swipeX: number; // 0 or negative (swiped left)
  dragging: boolean;
  onHeaderPointerDown: (e: React.PointerEvent) => void;
  onChangeAmount: (n: number) => void;
  onDelete: () => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}

export default function GroupCard({
  group,
  allocation,
  expanded,
  swipeX,
  dragging,
  onHeaderPointerDown,
  onChangeAmount,
  onDelete,
  rowRef,
}: GroupCardProps) {
  const amount = allocation?.amount ?? 0;

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
          <span
            className="min-w-0 flex-1 truncate text-[15px] font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {group.name}
          </span>
          <span
            className="shrink-0 text-sm font-medium tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {formatMoney(amount)}
          </span>
        </div>

        {/* Inline edit panel */}
        {expanded && (
          <div className="border-t px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
            <MoneyField label="Amount" value={amount} onSave={onChangeAmount} />
          </div>
        )}
      </div>
    </div>
  );
}
