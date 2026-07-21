import { Fragment, useEffect, useState } from 'react';
import { formatMoney, parseMoney, type CardCharge, type CreditCard } from '../../types/budget';
import SwipeRow from './SwipeRow';

/** "Jul 21" from an ISO timestamp. */
function chargeDate(iso?: string): string {
  return iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
}

const NAME_W = 140;
const COL_MIN = 110;
const TRASH_W = 44;
const MIN_TABLE_W = NAME_W + COL_MIN * 2 + TRASH_W;
const ROW_MIN_H = 56;

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

/** Inline money input: raw while focused, formatted on blur. */
function MoneyCell({ value, onSave }: { value: number; onSave: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';
  return (
    <input
      data-no-drag
      inputMode="decimal"
      placeholder="$0"
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setText(value ? String(value) : '');
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = parseMoney(text);
        if (n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="w-full rounded-lg border px-2 text-right text-[15px] tabular-nums outline-none"
      style={{ height: '38px', background: 'var(--color-bg-surface)', borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)', color: 'var(--color-text-primary)' }}
    />
  );
}

/** Inline date input for the due date. */
function DateCell({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  return (
    <input
      data-no-drag
      type="date"
      value={value ?? ''}
      onChange={(e) => onSave(e.target.value || null)}
      className="w-full rounded-lg border px-2 text-[13px] outline-none"
      style={{ height: '38px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
    />
  );
}

function NameField({ value, onSave }: { value: string; onSave: (s: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      data-no-drag
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const t = text.trim();
        if (t && t !== value) onSave(t);
        else setText(value);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="min-w-0 flex-1 rounded-lg border-0 bg-transparent text-[15px] font-medium outline-none"
      style={{ color: 'var(--color-text-primary)' }}
    />
  );
}

interface Props {
  cards: CreditCard[];
  /** Remaining balance after recorded payments (for the sub-line). */
  remainingOf: (card: CreditCard) => number;
  /** The charge log for a card. */
  chargesOf: (cardId: string) => CardCharge[];
  onAdd: (name: string, balance: number, dueDate: string | null) => void;
  onUpdate: (id: string, patch: { name?: string; balance?: number; due_date?: string | null }) => void;
  onDelete: (id: string) => void;
  onDeleteCharge: (charge: CardCharge) => void;
}

/**
 * Credit Card Payments (Overview): each card carries a balance owed and a due
 * date, both editable. The remaining balance (after payments recorded in the
 * Paycheck view) shows as a sub-line. You pay cards down per pay day in the
 * Paycheck view.
 */
export default function CreditCardSection({ cards, remainingOf, chargesOf, onAdd, onUpdate, onDelete, onDeleteCharge }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalRemaining = cards.reduce((s, c) => s + remainingOf(c), 0);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, parseMoney(balance), dueDate || null);
    setName('');
    setBalance('');
    setDueDate('');
    setAdding(false);
  };

  const cellBase = 'flex items-center justify-end px-3 tabular-nums';

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
        Credit Card Payments
      </h2>
      <div className="overflow-x-auto rounded-2xl border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
        <div style={{ minWidth: MIN_TABLE_W }}>
          <div className="flex items-center border-b" style={{ borderColor: 'var(--color-border)', height: '40px' }}>
            <div className="px-4 text-[11px] font-medium uppercase" style={{ width: NAME_W, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Card
            </div>
            <div className="flex-1 px-3 text-right text-[11px] font-medium uppercase" style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Balance
            </div>
            <div className="flex-1 px-3 text-right text-[11px] font-medium uppercase" style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Due
            </div>
            <div style={{ width: TRASH_W }} />
          </div>

          {cards.length === 0 ? (
            <div className="flex items-center justify-center px-4 py-8 text-center text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
              No credit cards yet
            </div>
          ) : (
            cards.map((c) => {
              const remaining = remainingOf(c);
              const paidDown = remaining < (Number(c.balance) || 0);
              const expanded = expandedId === c.id;
              const charges = expanded ? chargesOf(c.id) : [];
              return (
                <Fragment key={c.id}>
                <SwipeRow onDelete={() => onDelete(c.id)}>
                  <div className="flex items-stretch" style={{ minHeight: ROW_MIN_H }}>
                    <div className="flex items-center gap-1 px-2 py-2" style={{ width: NAME_W }}>
                      <button
                        data-no-drag
                        type="button"
                        aria-label={expanded ? 'Hide charges' : 'Show charges'}
                        onClick={() => setExpandedId((id) => (id === c.id ? null : c.id))}
                        className="grid h-7 w-5 shrink-0 place-items-center"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}>
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </button>
                      <NameField value={c.name} onSave={(name) => onUpdate(c.id, { name })} />
                    </div>
                    <div className={`${cellBase} flex-1`} style={{ minWidth: COL_MIN }}>
                      <span className="flex flex-col items-end leading-tight">
                        <MoneyCell value={Number(c.balance) || 0} onSave={(n) => onUpdate(c.id, { balance: n })} />
                        {paidDown && (
                          <span className="mt-0.5 text-[11px]" style={{ color: 'var(--color-success)' }}>
                            {formatMoney(remaining)} left
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex flex-1 items-center px-3" style={{ minWidth: COL_MIN }}>
                      <DateCell value={c.due_date} onSave={(v) => onUpdate(c.id, { due_date: v })} />
                    </div>
                    <TrashButton label={c.name} onDelete={() => onDelete(c.id)} />
                  </div>
                </SwipeRow>
                {expanded && (
                  <div className="border-t px-4 py-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-surface)' }}>
                    <span className="mb-2 block text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
                      Charges
                    </span>
                    {charges.length === 0 ? (
                      <p className="text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
                        Nothing charged yet. Add one from Scheduled Expenses → “Charge to a credit card”.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {charges.map((ch) => (
                          <div key={ch.id} className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-[14px]" style={{ color: 'var(--color-text-primary)' }}>
                              {ch.name}
                            </span>
                            <span className="flex shrink-0 items-center gap-3">
                              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                                {chargeDate(ch.created_at)}
                              </span>
                              <span className="text-[14px] tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                                {formatMoney(Number(ch.amount) || 0)}
                              </span>
                              <button
                                type="button"
                                aria-label={`Delete charge ${ch.name}`}
                                onClick={() => {
                                  if (window.confirm(`Remove "${ch.name}" (${formatMoney(Number(ch.amount) || 0)})? This also lowers the card balance.`)) onDeleteCharge(ch);
                                }}
                                className="grid h-7 w-7 place-items-center rounded-lg active:opacity-70"
                                style={{ color: 'var(--color-text-tertiary)' }}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 6 6 18M6 6l12 12" />
                                </svg>
                              </button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </Fragment>
              );
            })
          )}

          <div className="flex items-center border-t" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-overlay)', minHeight: ROW_MIN_H }}>
            <div className="px-4 text-[15px] font-semibold" style={{ width: NAME_W, color: 'var(--color-text-primary)' }}>
              Total owed
            </div>
            <div className="flex flex-1 items-center justify-end px-3 text-[15px] font-semibold tabular-nums" style={{ minWidth: COL_MIN, color: 'var(--color-text-primary)' }}>
              {formatMoney(totalRemaining)}
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
              placeholder="Card name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
              style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <input
              inputMode="decimal"
              placeholder="Balance"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-28 rounded-xl border px-3 text-right text-base tabular-nums outline-none"
              style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
              style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
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
          + Add credit card
        </button>
      )}
    </div>
  );
}
