import { useState } from 'react';
import { formatMoney, parseMoney, toISODate, type CreditCard, type ScheduledExpense } from '../../types/budget';
import SwipeRow from './SwipeRow';

const NAME_W = 140;
const COL_MIN = 100;
const TRASH_W = 44;
const MIN_TABLE_W = NAME_W + COL_MIN * 2 + TRASH_W;
const ROW_MIN_H = 52;

/** A small trash button (confirms before firing). */
function TrashButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-center" style={{ width: TRASH_W }}>
      <button
        data-no-drag
        type="button"
        aria-label={`Delete ${label}`}
        onClick={() => {
          if (window.confirm(`Delete "${label}"?`)) onDelete();
        }}
        className="grid h-9 w-9 place-items-center rounded-lg active:opacity-70"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </div>
  );
}

/** "July 2026" from a YYYY-MM-01 string. */
function monthLabelOf(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** "Thu, Jul 30" from a YYYY-MM-DD string. */
function payDateLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

interface Props {
  /** Expenses due in the currently-viewed month (already filtered). */
  expenses: ScheduledExpense[];
  /** First day (YYYY-MM-01) of the currently-viewed month. */
  monthStart: string;
  monthLabel: string;
  /** Cards available to charge an expense to. */
  cards: CreditCard[];
  onAdd: (name: string, amount: number, dueDate: string) => void;
  /** Charge the (named) amount to a card's balance instead of scheduling cash. */
  onChargeToCard: (cardId: string, name: string, amount: number) => void;
  onDelete: (id: string) => void;
}

/**
 * Scheduled (one-off / irregular) expenses due in the viewed month. Each is a
 * lump monthly cost — it counts toward the month's monthly total only (never
 * weekly) and never repeats. New expenses can be scheduled for this month or the
 * next two via the month dropdown.
 */
export default function ScheduledExpensesSection({ expenses, monthStart, monthLabel, cards, onAdd, onChargeToCard, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [charge, setCharge] = useState(false);
  const [cardId, setCardId] = useState('');

  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const openAdd = () => {
    // Default the due date to today (or this month if viewing another month).
    const today = toISODate(new Date());
    setDueDate(today.slice(0, 7) === monthStart.slice(0, 7) ? today : monthStart);
    setCardId(cards[0]?.id ?? '');
    setCharge(false);
    setAdding(true);
  };

  const reset = () => {
    setName('');
    setAmount('');
    setCharge(false);
    setAdding(false);
  };

  const submit = () => {
    const amt = parseMoney(amount);
    const n = name.trim();
    if (charge) {
      if (!cardId || !n || !(amt > 0)) return;
      onChargeToCard(cardId, n, amt);
      reset();
      return;
    }
    if (!n || !dueDate) return;
    onAdd(n, amt, dueDate);
    reset();
  };

  const cellBase = 'flex items-center justify-end px-3 tabular-nums';

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
        Scheduled Expenses · {monthLabel}
      </h2>
      <div className="overflow-x-auto rounded-2xl border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
        <div style={{ minWidth: MIN_TABLE_W }}>
          <div className="flex items-center border-b" style={{ borderColor: 'var(--color-border)', height: '40px' }}>
            <div className="px-4 text-[11px] font-medium uppercase" style={{ width: NAME_W, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Name
            </div>
            <div className="flex-1 px-3 text-right text-[11px] font-medium uppercase" style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Amount
            </div>
            <div className="flex-1 px-3 text-right text-[11px] font-medium uppercase" style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Due
            </div>
            <div style={{ width: TRASH_W }} />
          </div>

          {expenses.length === 0 ? (
            <div className="flex items-center justify-center px-4 py-8 text-center text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Nothing scheduled this month
            </div>
          ) : (
            expenses.map((e) => (
              <SwipeRow key={e.id} onDelete={() => onDelete(e.id)}>
                <div className="flex items-stretch" style={{ minHeight: ROW_MIN_H }}>
                  <div className="flex items-center px-4 py-2" style={{ width: NAME_W }}>
                    <span className="truncate text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      {e.name}
                    </span>
                  </div>
                  <div className={`${cellBase} flex-1`} style={{ minWidth: COL_MIN }}>
                    <span className="text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
                      {formatMoney(Number(e.amount) || 0)}
                    </span>
                  </div>
                  <div className={`${cellBase} flex-1`} style={{ minWidth: COL_MIN }}>
                    <span className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {e.due_date ? payDateLabel(e.due_date) : monthLabelOf(e.due_month)}
                    </span>
                  </div>
                  <TrashButton label={e.name} onDelete={() => onDelete(e.id)} />
                </div>
              </SwipeRow>
            ))
          )}

          <div className="flex items-center border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-overlay)', minHeight: ROW_MIN_H }}>
            <div className="px-4 text-[15px] font-semibold" style={{ width: NAME_W, color: 'var(--color-text-primary)' }}>
              Total
            </div>
            <div className="flex flex-1 items-center justify-end px-3 text-[15px] font-semibold tabular-nums" style={{ minWidth: COL_MIN, color: 'var(--color-text-primary)' }}>
              {formatMoney(total)}
            </div>
            <div className="flex-1" style={{ minWidth: COL_MIN }} />
            <div style={{ width: TRASH_W }} />
          </div>
        </div>
      </div>

      {adding ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              autoFocus
              placeholder="Expense name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
              style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <input
              inputMode="decimal"
              placeholder="$0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-24 rounded-xl border px-3 text-right text-base tabular-nums outline-none"
              style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          {cards.length > 0 && (
            <label className="flex items-center gap-2 py-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <input type="checkbox" checked={charge} onChange={(e) => setCharge(e.target.checked)} className="h-4 w-4" />
              Charge to a credit card (adds to its balance)
            </label>
          )}
          <div className="flex gap-2">
            {charge ? (
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
                style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {cards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
                style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              />
            )}
            <button
              type="button"
              onClick={submit}
              className="rounded-xl px-5 text-sm font-semibold"
              style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', minHeight: '46px' }}
            >
              {charge ? 'Charge' : 'Add'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={openAdd}
          className="mt-3 w-full rounded-xl border py-2.5 text-sm font-semibold"
          style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', minHeight: '46px' }}
        >
          + Add scheduled expense
        </button>
      )}
    </div>
  );
}
