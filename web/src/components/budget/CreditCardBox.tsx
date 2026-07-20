import { useEffect, useState } from 'react';
import {
  creditCardPayment,
  formatMoney,
  parseMoney,
  type BudgetGroup,
} from '../../types/budget';

interface Props {
  cards: BudgetGroup[];
  /** This-month payment for a card (payoff-window aware). */
  monthlyOf: (g: BudgetGroup) => number;
  onAdd: (name: string) => void;
  onUpdate: (
    id: string,
    patch: { name?: string; cc_total?: number; cc_start_date?: string | null; cc_due_date?: string | null }
  ) => void;
  onDelete: (id: string) => void;
}

const CARD_COLOR = '#5c9eff';

/** Money field (raw while focused, formatted on blur). */
function MoneyField({ label, value, onSave }: { label: string; value: number; onSave: (n: number) => void }) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';
  return (
    <label className="flex-1">
      <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <input
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
        className="w-full rounded-xl border px-3 text-base tabular-nums outline-none"
        style={{
          height: '46px',
          background: 'var(--color-bg-surface)',
          borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </label>
  );
}

/** A native date field. */
function DateField({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  return (
    <label className="flex-1">
      <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </span>
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onSave(e.target.value || null)}
        className="w-full rounded-xl border px-3 text-base outline-none"
        style={{ height: '46px', background: 'var(--color-bg-base)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
      />
    </label>
  );
}

/** Editable card name (saves on blur / Enter, reverts if emptied). */
function NameField({ value, onSave }: { value: string; onSave: (s: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const t = text.trim();
    if (t && t !== value) onSave(t);
    else setText(value);
  };
  return (
    <input
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className="min-w-0 flex-1 rounded-lg border-0 bg-transparent text-[15px] font-medium outline-none"
      style={{ color: 'var(--color-text-primary)' }}
    />
  );
}

export default function CreditCardBox({ cards, monthlyOf, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const monthTotal = cards.reduce((s, c) => s + monthlyOf(c), 0);

  const submit = () => {
    const n = newName.trim();
    if (!n) return;
    onAdd(n);
    setNewName('');
    setAdding(false);
  };

  return (
    <div
      className="mt-6 rounded-2xl border"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Credit cards
        </span>
        {cards.length > 0 && (
          <span className="text-sm tabular-nums" style={{ color: 'var(--color-text-secondary)' }}>
            {formatMoney(monthTotal)} this month
          </span>
        )}
      </div>

      <div className="border-t px-4 py-4" style={{ borderColor: 'var(--color-border)' }}>
        {cards.length === 0 && !adding && (
          <p className="mb-3 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
            Track a card balance and its weekly payoff payment.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {cards.map((c) => {
            const payment = creditCardPayment(c);
            const thisMonth = monthlyOf(c);
            const dueLabel = c.cc_due_date
              ? new Date(c.cc_due_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              : null;
            return (
              <div
                key={c.id}
                className="rounded-xl border p-3"
                style={{ background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)' }}
              >
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  <NameField value={c.name} onSave={(name) => onUpdate(c.id, { name })} />
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Delete ${c.name}?`)) onDelete(c.id);
                    }}
                    aria-label={`Delete ${c.name}`}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold"
                    style={{ color: 'var(--color-danger)' }}
                  >
                    Delete
                  </button>
                </div>

                <MoneyField label="Amount owed" value={c.cc_total} onSave={(n) => onUpdate(c.id, { cc_total: n })} />

                <div className="mt-2.5 flex items-end gap-2.5">
                  <DateField label="Start paying" value={c.cc_start_date} onSave={(v) => onUpdate(c.id, { cc_start_date: v })} />
                  <DateField label="Paid off by" value={c.cc_due_date} onSave={(v) => onUpdate(c.id, { cc_due_date: v })} />
                </div>

                <div
                  className="mt-3 flex items-center justify-between rounded-xl px-3 py-2.5"
                  style={{ background: 'var(--color-accent-subtle)' }}
                >
                  <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    {payment > 0 ? `${formatMoney(payment)}/pay date` : 'Set dates'}{dueLabel ? ` · due ${dueLabel}` : ''}
                  </span>
                  <span className="text-sm font-semibold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
                    {formatMoney(thisMonth)} this month
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {adding ? (
          <div className="mt-3 flex gap-2">
            <input
              autoFocus
              placeholder="Card name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
              style={{ height: '46px', background: 'var(--color-bg-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
            />
            <button
              type="button"
              onClick={submit}
              className="rounded-full px-5 text-sm font-semibold"
              style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', minHeight: '46px' }}
            >
              Add
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 w-full rounded-full border py-2.5 text-sm font-semibold"
            style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', minHeight: '46px' }}
          >
            + Add card
          </button>
        )}
      </div>
    </div>
  );
}

export { CARD_COLOR };
