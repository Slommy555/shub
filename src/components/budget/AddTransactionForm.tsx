import { useState } from 'react';
import type { BudgetCategory, RecurringInterval, TxType } from '../../types/budget';
import { TX_TYPES, TX_TYPE_LABEL } from '../../types/budget';
import type { NewTransaction } from '../../hooks/budget/useBudgetTransactions';
import { todayLocalISO } from '../../lib/budget';

const INTERVALS: RecurringInterval[] = ['daily', 'weekly', 'monthly', 'yearly'];

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

interface Props {
  categories: BudgetCategory[];
  /** Prefill for edit mode. */
  initial?: Partial<NewTransaction>;
  submitLabel?: string;
  onSubmit: (tx: NewTransaction) => void;
  onCancel?: () => void;
}

export default function AddTransactionForm({ categories, initial, submitLabel = 'Add', onSubmit, onCancel }: Props) {
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null);
  const [description, setDescription] = useState(initial?.description ?? '');
  const [date, setDate] = useState(initial?.date ?? todayLocalISO());
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);
  const [interval, setInterval] = useState<RecurringInterval>(initial?.recurring_interval ?? 'monthly');

  const catsForType = categories.filter((c) => c.type === type);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return;
    onSubmit({
      type,
      amount: amt,
      category_id: categoryId,
      description: description.trim() || null,
      date,
      recurring,
      recurring_interval: recurring ? interval : null,
    });
    if (!initial) {
      setAmount('');
      setDescription('');
      setRecurring(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2.5 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      {/* Type toggle */}
      <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
        {TX_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setType(t);
              setCategoryId(null);
            }}
            className={[
              'flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              type === t
                ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
            ].join(' ')}
          >
            {TX_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount"
          aria-label="Amount"
          className={inputCls}
          autoFocus
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label="Date"
          className={inputCls}
        />
      </div>

      <select
        value={categoryId ?? ''}
        onChange={(e) => setCategoryId(e.target.value || null)}
        aria-label="Category"
        className={inputCls}
      >
        <option value="">Uncategorized</option>
        {catsForType.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        aria-label="Description"
        className={inputCls}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-gray-700 dark:border-gray-600 dark:bg-gray-800"
          />
          Recurring
        </label>
        {recurring && (
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value as RecurringInterval)}
            aria-label="Recurring interval"
            className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
          >
            {INTERVALS.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        )}
        <div className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-gray-200 dark:text-gray-900"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
