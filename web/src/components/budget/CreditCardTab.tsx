import { useState } from 'react';
import type { UseCreditCardPayoffs } from '../../hooks/budget/useCreditCardPayoffs';
import { BUDGET_COLORS } from '../../types/budget';
import CreditCardPayoffCard from './CreditCardPayoffCard';

const inputCls =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

export default function CreditCardTab({
  api,
  currency,
}: {
  api: UseCreditCardPayoffs;
  currency: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [color, setColor] = useState(BUDGET_COLORS[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!name.trim() || !Number.isFinite(amt) || amt < 0) return;
    api.addPayoff({ name, total_amount: amt, color });
    setName('');
    setAmount('');
    setShowForm(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Track what you've spent on a card and schedule weekly payments to pay it down. Due payments
        show up in your daily brief.
      </p>

      {showForm ? (
        <form onSubmit={submit} className="space-y-2.5 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Card name (e.g. Chase Visa)" aria-label="Card name" className={inputCls} autoFocus />
          <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount spent / balance" aria-label="Amount spent" className={inputCls} />
          <div className="flex flex-wrap items-center gap-1.5">
            {BUDGET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Color ${c}`}
                className={`h-6 w-6 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-gray-500 dark:ring-offset-gray-900' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 dark:border-gray-700 dark:text-gray-300">
                Cancel
              </button>
              <button type="submit" className="rounded-lg bg-gray-800 px-4 py-1.5 text-sm font-semibold text-white dark:bg-gray-200 dark:text-gray-900">
                Add card
              </button>
            </div>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="w-full rounded-2xl border border-dashed border-gray-300 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          + New credit card
        </button>
      )}

      {api.payoffs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 py-8 text-center text-xs text-gray-400 dark:border-gray-800">
          No cards yet. Add one to start planning your payoff.
        </p>
      ) : (
        <div className="space-y-2">
          {api.payoffs.map((p) => (
            <CreditCardPayoffCard
              key={p.id}
              payoff={p}
              payments={api.payments.filter((pm) => pm.payoff_id === p.id)}
              currency={currency}
              onUpdatePayoff={api.updatePayoff}
              onDeletePayoff={api.deletePayoff}
              onAddPayment={api.addPayment}
              onTogglePaid={(id, paid) => api.updatePayment(id, { paid })}
              onDeletePayment={api.deletePayment}
            />
          ))}
        </div>
      )}
    </div>
  );
}
