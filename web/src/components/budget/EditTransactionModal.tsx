import type { BudgetCategory, BudgetTransaction } from '../../types/budget';
import type { NewTransaction } from '../../hooks/budget/useBudgetTransactions';
import AddTransactionForm from './AddTransactionForm';

interface Props {
  tx: BudgetTransaction;
  categories: BudgetCategory[];
  onSave: (id: string, patch: NewTransaction) => void;
  onClose: () => void;
}

/**
 * Edit an existing transaction. On mobile it slides up as a bottom sheet; on
 * desktop it's a centered modal. All fields (amount, type, category,
 * description, date, recurring) come pre-filled from the transaction and are
 * edited via the shared AddTransactionForm. Saving writes the change through and
 * closes; cancel closes without saving.
 */
export default function EditTransactionModal({ tx, categories, onSave, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-t-3xl bg-white shadow-xl animate-slide-up dark:bg-gray-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 p-3 dark:border-gray-800">
          <h2 className="text-sm font-semibold">Edit transaction</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            ✕
          </button>
        </div>
        <div className="p-3">
          <AddTransactionForm
            categories={categories}
            initial={{
              type: tx.type,
              amount: Number(tx.amount),
              category_id: tx.category_id,
              description: tx.description,
              date: tx.date,
              recurring: tx.recurring,
              recurring_interval: tx.recurring_interval,
            }}
            submitLabel="Save changes"
            onSubmit={(patch) => {
              onSave(tx.id, patch);
              onClose();
            }}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
