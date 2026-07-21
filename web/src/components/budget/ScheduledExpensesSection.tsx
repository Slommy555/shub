import { useState } from 'react';
import { formatMoney, parseMoney, type ScheduledExpense } from '../../types/budget';
import SwipeRow from './SwipeRow';

const NAME_W = 140;
const COL_MIN = 100;
const MIN_TABLE_W = NAME_W + COL_MIN * 2;
const ROW_MIN_H = 52;

/** "YYYY-MM-01" for the month `offset` months after monthStart. */
function monthOffset(monthStartISO: string, offset: number): string {
  const [y, m] = monthStartISO.split('-').map(Number);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** "July 2026" from a YYYY-MM-01 string. */
function monthLabelOf(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

interface Props {
  /** Expenses due in the currently-viewed month (already filtered). */
  expenses: ScheduledExpense[];
  /** First day (YYYY-MM-01) of the currently-viewed month. */
  monthStart: string;
  monthLabel: string;
  onAdd: (name: string, amount: number, dueMonth: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Scheduled (one-off / irregular) expenses due in the viewed month. Each is a
 * lump monthly cost — it counts toward the month's monthly total only (never
 * weekly) and never repeats. New expenses can be scheduled for this month or the
 * next two via the month dropdown.
 */
export default function ScheduledExpensesSection({ expenses, monthStart, monthLabel, onAdd, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueMonth, setDueMonth] = useState(monthStart);

  const monthOptions = [0, 1, 2].map((o) => monthOffset(monthStart, o));
  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, parseMoney(amount), dueMonth);
    setName('');
    setAmount('');
    setDueMonth(monthStart);
    setAdding(false);
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
                      {monthLabelOf(e.due_month)}
                    </span>
                  </div>
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
          <div className="flex gap-2">
            <select
              value={dueMonth}
              onChange={(e) => setDueMonth(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
              style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            >
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {monthLabelOf(m)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={submit}
              className="rounded-xl px-5 text-sm font-semibold"
              style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', minHeight: '46px' }}
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 w-full rounded-xl border py-2.5 text-sm font-semibold"
          style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', minHeight: '46px' }}
        >
          + Add scheduled expense
        </button>
      )}
    </div>
  );
}
