import { useMemo, useState } from 'react';
import type { BudgetCategory, BudgetTransaction, TxType } from '../../types/budget';
import type { UseBudgetTransactions } from '../../hooks/budget/useBudgetTransactions';
import { currentMonth, formatDayLabel, monthLabel, shiftMonth } from '../../lib/budget';
import AddTransactionForm from './AddTransactionForm';
import EditTransactionModal from './EditTransactionModal';
import TransactionCard from './TransactionCard';

type Filter = 'all' | TxType;
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expenses' },
  { id: 'savings', label: 'Savings' },
];

interface Props {
  api: UseBudgetTransactions;
  categories: BudgetCategory[];
  currency: string;
}

export default function TransactionsTab({ api, categories, currency }: Props) {
  const [month, setMonth] = useState(currentMonth());
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<BudgetTransaction | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [categoryId, setCategoryId] = useState<string>('');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return api.transactions.filter((t) => {
      if (t.date.slice(0, 7) !== month) return false;
      if (filter !== 'all' && t.type !== filter) return false;
      if (categoryId && t.category_id !== categoryId) return false;
      if (q && !(t.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [api.transactions, month, filter, categoryId, search]);

  const groups = useMemo(() => {
    const map = new Map<string, BudgetTransaction[]>();
    for (const t of visible) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [visible]);

  return (
    <div className="space-y-3">
      {/* Add form (collapsible). Editing happens in a modal/bottom sheet below. */}
      {showAdd ? (
        <AddTransactionForm
          categories={categories}
          onSubmit={(tx) => {
            api.addTransaction(tx);
            setShowAdd(false);
          }}
          onCancel={() => setShowAdd(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="w-full rounded-2xl border border-dashed border-gray-300 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          + Add transaction
        </button>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((mo) => shiftMonth(mo, -1))}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          ‹
        </button>
        <span className="text-sm font-semibold">{monthLabel(month)}</span>
        <button
          type="button"
          onClick={() => setMonth((mo) => shiftMonth(mo, 1))}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          ›
        </button>
      </div>

      {/* Filter bar */}
      <div className="space-y-2">
        <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={[
                'flex-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                filter === f.id
                  ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                  : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="Filter by category"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search transactions"
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
          />
        </div>
      </div>

      {/* Grouped list */}
      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400 dark:border-gray-800">
          No transactions for this month.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, list]) => (
            <div key={date}>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {formatDayLabel(date)}
              </p>
              <div className="space-y-2">
                {list.map((t) => (
                  <TransactionCard
                    key={t.id}
                    tx={t}
                    category={categories.find((c) => c.id === t.category_id) ?? null}
                    currency={currency}
                    onEdit={setEditing}
                    onDelete={(tx) => api.deleteTransaction(tx.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <EditTransactionModal
          tx={editing}
          categories={categories}
          onSave={(id, patch) => api.updateTransaction(id, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
