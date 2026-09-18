import { useRef, useState } from 'react';
import { formatEntryTime, formatMoney, parseAmount } from '../../lib/spend';
import type { SpendEntry } from '../../types/spend';

/** How far left the row must travel before releasing it asks to delete. */
const COMMIT_PX = 64;
/** How far the row can slide — just enough to show the delete panel behind it. */
const MAX_PX = 96;
/** Movement past this means the finger is swiping, not tapping. */
const TAP_SLOP = 8;

const inputStyle: React.CSSProperties = {
  height: 44,
  background: 'var(--color-bg-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

/**
 * One logged spend.
 *
 * Tap it to edit the amount or label in place; swipe it left to delete (which
 * asks first). The swipe follows the finger directly and only animates on
 * release, per UI_SKILL.md — and `data-no-swipe` keeps the page's own
 * left/right tab navigation out of the gesture.
 */
export default function SpendEntryRow({
  entry,
  onSave,
  onDelete,
}: {
  entry: SpendEntry;
  onSave: (patch: { amount?: number; label?: string | null }) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const start = useRef<{ x: number; y: number } | null>(null);
  const swiping = useRef(false);
  // A touch that turned into a swipe still fires a click on release — that
  // click would otherwise open the editor the swipe was never asking for.
  const swallowClick = useRef(false);

  function openEditor() {
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    setAmount(String(Number(entry.amount)));
    setLabel(entry.label ?? '');
    setEditing(true);
  }

  function commit() {
    const parsed = parseAmount(amount);
    onSave({ amount: parsed ?? undefined, label });
    setEditing(false);
  }

  function settle() {
    setAnimating(true);
    setDx(0);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length !== 1) return;
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    swiping.current = false;
    setAnimating(false);
  }

  function onTouchMove(e: React.TouchEvent) {
    const s = start.current;
    if (!s) return;
    const moveX = e.touches[0].clientX - s.x;
    const moveY = e.touches[0].clientY - s.y;
    // Let a vertical drag scroll the page instead of dragging the row.
    if (!swiping.current) {
      if (Math.abs(moveY) > Math.abs(moveX)) {
        start.current = null;
        return;
      }
      if (Math.abs(moveX) < TAP_SLOP) return;
      swiping.current = true;
    }
    setDx(Math.max(-MAX_PX, Math.min(0, moveX)));
  }

  function onTouchEnd() {
    const wasSwiping = swiping.current;
    start.current = null;
    swiping.current = false;
    if (!wasSwiping) return;
    swallowClick.current = true;
    const committed = dx <= -COMMIT_PX;
    settle();
    if (committed) requestDelete();
  }

  function requestDelete() {
    const what = entry.label ? `“${entry.label}”` : 'this entry';
    if (window.confirm(`Delete ${what} (${formatMoney(Number(entry.amount))})?`)) onDelete();
  }

  if (editing) {
    return (
      <div className="px-4 py-3" data-no-swipe>
        <div className="flex gap-2">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            aria-label="Amount"
            autoFocus
            className="w-28 shrink-0 rounded-xl border px-3 text-[15px] tabular-nums outline-none"
            style={inputStyle}
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="What was it for?"
            aria-label="Label"
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') setEditing(false);
            }}
            className="min-w-0 flex-1 rounded-xl border px-3 text-[15px] outline-none"
            style={inputStyle}
          />
        </div>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={requestDelete}
            className="rounded-full border px-4 text-[13px] font-semibold active:opacity-70"
            style={{
              height: 40,
              borderColor: 'color-mix(in srgb, var(--color-danger) 40%, transparent)',
              color: 'var(--color-danger)',
            }}
          >
            Delete
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-full px-4 text-[13px] font-semibold active:opacity-70"
            style={{ height: 40, color: 'var(--color-text-secondary)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={commit}
            className="rounded-full px-5 text-[13px] font-semibold active:scale-[0.98] active:opacity-85"
            style={{
              height: 40,
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
            }}
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden" data-no-swipe>
      {/* The delete panel the swipe reveals from the right edge. */}
      <div
        aria-hidden={dx === 0}
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-center text-[13px] font-semibold"
        style={{ background: 'var(--color-danger)', color: '#fff', opacity: dx === 0 ? 0 : 1 }}
      >
        Delete
      </div>

      <button
        type="button"
        onClick={openEditor}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        className="relative flex w-full items-center gap-3 px-4 py-3 text-left"
        style={{
          minHeight: 64,
          background: 'var(--color-bg-elevated)',
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: animating ? 'transform 200ms ease-in' : 'none',
        }}
        onTransitionEnd={() => setAnimating(false)}
      >
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[15px]"
            style={{
              color: entry.label ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
            }}
          >
            {entry.label || 'No label'}
          </span>
          <span className="mt-0.5 block text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            {formatEntryTime(entry.created_at)}
          </span>
        </span>
        <span
          className="shrink-0 text-[17px] font-medium tabular-nums"
          style={{ color: 'var(--color-text-primary)' }}
        >
          {formatMoney(Number(entry.amount))}
        </span>
      </button>
    </div>
  );
}
