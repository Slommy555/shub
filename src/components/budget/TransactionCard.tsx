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
 * A single transaction row. Tap to edit (when onEdit given); swipe left on mobile
 * to delete (when onDelete given). Read-only otherwise (e.g. Overview "Recent").
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
  const startX = useRef<number | null>(null);
  const color = category?.color ?? '#9ca3af';

  return (
    <div className="relative overflow-hidden rounded-xl">
      {onDelete && (
        <div className="absolute inset-y-0 right-0 flex w-20 items-center justify-center bg-red-500 text-xs font-medium text-white">
          Delete
        </div>
      )}
      <button
        type="button"
        onClick={() => onEdit?.(tx)}
        disabled={!onEdit}
        className="relative flex w-full items-center gap-3 border border-gray-200 bg-white px-3 py-2.5 text-left dark:border-gray-800 dark:bg-gray-900"
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
          if (dx < -60 && onDelete) {
            if (window.confirm('Delete this transaction?')) onDelete(tx);
          }
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
      </button>
    </div>
  );
}
