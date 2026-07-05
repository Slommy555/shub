import { useRef, useState } from 'react';
import type { BudgetCategory, BudgetTransaction } from '../../types/budget';
import { formatMoney } from '../../lib/budget';

const SIGN: Record<string, string> = { income: '+', expense: '-', savings: '→' };
const AMOUNT_TONE: Record<string, string> = {
  income: 'text-green-600 dark:text-green-400',
  expense: 'text-red-600 dark:text-red-400',
  savings: 'text-indigo-600 dark:text-indigo-400',
};

/**
 * A single transaction row. Tap the row to edit (when onEdit given). Delete
 * (when onDelete given) via either the always-visible trash icon (desktop, and
 * a mobile fallback) or swiping the row left to reveal the red Delete strip —
 * both funnel through the same confirmation dialog. Read-only otherwise (e.g.
 * the Overview "Recent" list passes neither handler).
 */
export default function TransactionCard({
  tx,
  category,
  currency,
  onEdit,
  onDelete,
}: {
  tx: BudgetTransaction;
  category: BudgetCategory | null;
  currency: string;
  onEdit?: (tx: BudgetTransaction) => void;
  onDelete?: (tx: BudgetTransaction) => void;
}) {
  const [dx, setDx] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const startX = useRef<number | null>(null);
  const color = category?.color ?? '#9ca3af';

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        {/* Red strip revealed by swiping the row left (mobile). */}
        {onDelete && (
          <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-500 text-xs font-medium text-white">
            Delete
          </div>
        )}
        <div
          role={onEdit ? 'button' : undefined}
          tabIndex={onEdit ? 0 : undefined}
          onClick={() => onEdit?.(tx)}
          onKeyDown={(e) => {
            if (onEdit && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onEdit(tx);
            }
          }}
          className={`relative flex w-full items-center gap-3 border border-gray-200 bg-white px-3 py-2.5 text-left dark:border-gray-800 dark:bg-gray-900 ${
            onEdit ? 'cursor-pointer' : ''
          }`}
          style={{
            transform: `translateX(${dx}px)`,
            transition: startX.current === null ? 'transform 0.15s' : 'none',
            borderRadius: 12,
          }}
          onTouchStart={(e) => {
            if (!onDelete) return;
            startX.current = e.touches[0].clientX;
          }}
          onTouchMove={(e) => {
            if (startX.current === null) return;
            const delta = e.touches[0].clientX - startX.current;
            if (delta < 0) setDx(Math.max(delta, -88));
          }}
          onTouchEnd={() => {
            if (dx < -60 && onDelete) setConfirming(true);
            setDx(0);
            startX.current = null;
          }}
        >
          <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{tx.description || category?.name || 'Transaction'}</p>
            <p className="truncate text-[11px] text-gray-400">
              {category?.name ?? 'Uncategorized'}
              {tx.recurring && ' · ↻ recurring'}
            </p>
          </div>
          <span className={`shrink-0 text-sm font-bold tabular-nums ${AMOUNT_TONE[tx.type]}`}>
            {SIGN[tx.type]}
            {formatMoney(Number(tx.amount), currency)}
          </span>
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setConfirming(true);
              }}
              aria-label="Delete transaction"
              title="Delete transaction"
              className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 5v6m4-6v6" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation — rendered outside the transformed/overflow-hidden row so it
          is never clipped and always centers over the viewport. */}
      {confirming && onDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold">Delete this transaction?</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">This cannot be undone.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  onDelete(tx);
                }}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
