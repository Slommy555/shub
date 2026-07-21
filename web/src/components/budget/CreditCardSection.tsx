import { useEffect, useState } from 'react';
import { formatMoney, parseMoney, type CreditCard } from '../../types/budget';
import SwipeRow from './SwipeRow';

const NAME_W = 140;
const COL_MIN = 100;
const MIN_TABLE_W = NAME_W + COL_MIN * 2;
const ROW_MIN_H = 52;

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
      style={{
        height: '38px',
        background: 'var(--color-bg-surface)',
        borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
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
  onAdd: (name: string, weekly: number) => void;
  onUpdate: (id: string, patch: { name?: string; weekly_payment?: number }) => void;
  onDelete: (id: string) => void;
}

/**
 * Credit Card Payments: a card name + a flat weekly payment (editable). The
 * ~Monthly column is weekly × 4, shown for reference only (tertiary, not counted
 * in monthly totals). The weekly total feeds the weekly remaining in the summary.
 */
export default function CreditCardSection({ cards, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [weekly, setWeekly] = useState('');

  const totalWeekly = cards.reduce((s, c) => s + (Number(c.weekly_payment) || 0), 0);

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, parseMoney(weekly));
    setName('');
    setWeekly('');
    setAdding(false);
  };

  const cellBase = 'flex items-center justify-end px-3 tabular-nums';

  return (
    <div className="mt-6">
      <h2
        className="mb-2 text-[11px] font-semibold uppercase"
        style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
      >
        Credit Card Payments
      </h2>
      <div
        className="overflow-x-auto rounded-2xl border"
        style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
      >
        <div style={{ minWidth: MIN_TABLE_W }}>
          <div className="flex items-center border-b" style={{ borderColor: 'var(--color-border)', height: '40px' }}>
            <div className="px-4 text-[11px] font-medium uppercase" style={{ width: NAME_W, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Card
            </div>
            <div className="flex-1 px-3 text-right text-[11px] font-medium uppercase" style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              Weekly
            </div>
            <div className="flex-1 px-3 text-right text-[11px] font-medium uppercase" style={{ minWidth: COL_MIN, letterSpacing: '0.04em', color: 'var(--color-text-secondary)' }}>
              ~Monthly
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="flex items-center justify-center px-4 py-8 text-center text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
              No credit cards yet
            </div>
          ) : (
            cards.map((c) => (
              <SwipeRow key={c.id} onDelete={() => onDelete(c.id)}>
                <div className="flex items-stretch" style={{ minHeight: ROW_MIN_H }}>
                  <div className="flex items-center gap-2.5 px-4 py-2" style={{ width: NAME_W }}>
                    <NameField value={c.name} onSave={(name) => onUpdate(c.id, { name })} />
                  </div>
                  <div className={`${cellBase} flex-1`} style={{ minWidth: COL_MIN }}>
                    <MoneyCell value={Number(c.weekly_payment) || 0} onSave={(n) => onUpdate(c.id, { weekly_payment: n })} />
                  </div>
                  <div className={`${cellBase} flex-1`} style={{ minWidth: COL_MIN }}>
                    <span className="text-[15px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      ~{formatMoney((Number(c.weekly_payment) || 0) * 4)}
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
              {formatMoney(totalWeekly)}/wk
            </div>
            <div className="flex-1" style={{ minWidth: COL_MIN }} />
          </div>
        </div>
      </div>

      {adding ? (
        <div className="mt-3 flex gap-2">
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
            placeholder="$/wk"
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
            className="w-24 rounded-xl border px-3 text-right text-base tabular-nums outline-none"
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
