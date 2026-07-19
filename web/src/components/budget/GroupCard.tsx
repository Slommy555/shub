import { useEffect, useState } from 'react';
import { formatMoney, parseMoney, PRESET_COLORS, type BudgetGroup } from '../../types/budget';

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

interface GroupCardProps {
  group: BudgetGroup;
  amount: number; // already scaled into the current timeframe
  expanded: boolean;
  swipeX: number; // 0 or negative (swiped left)
  dragging: boolean;
  onHeaderPointerDown: (e: React.PointerEvent) => void;
  onChangeAmount: (n: number) => void;
  onChangeName: (name: string) => void;
  onChangeColor: (color: string) => void;
  onTogglePersistent: (persistent: boolean) => void;
  onDelete: () => void;
  rowRef?: (el: HTMLDivElement | null) => void;
}

export default function GroupCard({
  group,
  amount,
  expanded,
  swipeX,
  dragging,
  onHeaderPointerDown,
  onChangeAmount,
  onChangeName,
  onChangeColor,
  onTogglePersistent,
  onDelete,
  rowRef,
}: GroupCardProps) {
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
          {!group.persistent && (
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ background: 'var(--color-bg-surface)', color: 'var(--color-text-tertiary)' }}
            >
              this period
            </span>
          )}
          <span
            className="shrink-0 text-sm font-medium tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {formatMoney(amount)}
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

            {/* Persistence toggle */}
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
                    ? 'Same every day/week/month, converts across views'
                    : 'One-time amount, only in this period'}
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

            <MoneyField
              label={group.persistent ? 'Amount' : 'Amount (this period)'}
              value={amount}
              onSave={onChangeAmount}
            />
          </div>
        )}
      </div>
    </div>
  );
}
