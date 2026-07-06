import { useState } from 'react';
import type { CreditCardPayment, CreditCardPayoff } from '../../types/budget';
import { formatDayLabel, formatMoney, todayLocalISO } from '../../lib/budget';

interface Props {
  payoff: CreditCardPayoff;
  payments: CreditCardPayment[]; // already filtered to this payoff
  currency: string;
  onUpdatePayoff: (id: string, patch: Partial<Pick<CreditCardPayoff, 'name' | 'total_amount'>>) => void;
  onDeletePayoff: (id: string) => void;
  onAddPayment: (input: { payoff_id: string; due_date: string; amount: number }) => void;
  onTogglePaid: (id: string, paid: boolean) => void;
  onDeletePayment: (id: string) => void;
}

const inputCls =
  'rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-gray-500 dark:border-gray-700 dark:bg-gray-950';

export default function CreditCardPayoffCard({
  payoff,
  payments,
  currency,
  onUpdatePayoff,
  onDeletePayoff,
  onAddPayment,
  onTogglePaid,
  onDeletePayment,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const color = payoff.color ?? '#ef4444';

  const paidSum = payments.filter((p) => p.paid).reduce((s, p) => s + Number(p.amount || 0), 0);
  const remaining = Math.max(0, payoff.total_amount - paidSum);
  const pct = payoff.total_amount > 0 ? Math.min(100, (paidSum / payoff.total_amount) * 100) : 0;
  const cleared = payoff.total_amount > 0 && remaining <= 0;
  const today = todayLocalISO();

  function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!date || !Number.isFinite(amt) || amt <= 0) return;
    onAddPayment({ payoff_id: payoff.id, due_date: date, amount: amt });
    setDate('');
    setAmount('');
    setAdding(false);
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <input
            defaultValue={payoff.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== payoff.name) onUpdatePayoff(payoff.id, { name: v });
            }}
            aria-label="Card name"
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Delete "${payoff.name}" and its payment plan? This cannot be undone.`)) {
              onDeletePayoff(payoff.id);
            }
          }}
          aria-label="Delete card"
          className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-red-500 dark:hover:bg-gray-800"
        >
          ×
        </button>
      </div>

      {/* Balance */}
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400">Remaining</p>
          <p className={`text-lg font-bold tabular-nums ${cleared ? 'text-green-600 dark:text-green-400' : ''}`}>
            {cleared ? 'Paid off 🎉' : formatMoney(remaining, currency)}
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-gray-400">
          Spent
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            defaultValue={payoff.total_amount}
            onBlur={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 0 && v !== payoff.total_amount) {
                onUpdatePayoff(payoff.id, { total_amount: v });
              }
            }}
            aria-label="Total spent on card"
            className={`w-24 ${inputCls}`}
          />
        </label>
      </div>

      {/* Progress */}
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cleared ? '#16a34a' : color }} />
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        {formatMoney(paidSum, currency)} paid of {formatMoney(payoff.total_amount, currency)} · {Math.round(pct)}%
      </p>

      {/* Scheduled payments */}
      {payments.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3 dark:border-gray-800">
          {payments.map((p) => {
            const overdue = !p.paid && p.due_date < today;
            return (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={p.paid}
                  onChange={(e) => onTogglePaid(p.id, e.target.checked)}
                  aria-label={p.paid ? 'Mark unpaid' : 'Mark paid'}
                  className="h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 text-green-600 focus:ring-green-400/40 dark:border-gray-600 dark:bg-gray-800"
                />
                <span className={`tabular-nums font-medium ${p.paid ? 'text-gray-400 line-through' : ''}`}>
                  {formatMoney(Number(p.amount), currency)}
                </span>
                <span className={`flex-1 text-xs ${overdue ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                  {p.paid ? 'paid' : overdue ? `overdue · ${formatDayLabel(p.due_date)}` : `by ${formatDayLabel(p.due_date)}`}
                </span>
                <button
                  type="button"
                  onClick={() => onDeletePayment(p.id)}
                  aria-label="Delete payment"
                  className="shrink-0 rounded p-0.5 text-gray-300 hover:text-red-500 dark:text-gray-600"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add scheduled payment */}
      <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
        {adding ? (
          <form onSubmit={submitPayment} className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Pay by week"
              className={inputCls}
              autoFocus
            />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              aria-label="Payment amount"
              className={`w-24 ${inputCls}`}
            />
            <button type="submit" className="rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white dark:bg-gray-200 dark:text-gray-900">
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-lg px-2 py-1.5 text-xs text-gray-500">
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            + Schedule a payment
          </button>
        )}
      </div>
    </div>
  );
}
