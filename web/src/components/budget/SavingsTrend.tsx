import { useState } from 'react';
import { formatMoney, parseMoney, toISODate } from '../../types/budget';
import { GRANULARITY_LABEL, type SavingsBucket, type SavingsEvent, type SavingsGranularity } from '../../lib/savingsSeries';
import type { SavingsAdjustment } from '../../hooks/budget/useSavingsAdjustments';
import SavingsTrendChart from './SavingsTrendChart';
import MoneyInput from './MoneyInput';

const GRANULARITIES: SavingsGranularity[] = ['daily', 'weekly', 'monthly'];
const PERIOD_NOUN: Record<SavingsGranularity, string> = { daily: 'day', weekly: 'week', monthly: 'month' };
/** Rows shown before "Show all" — one screenful, so the list never needs its own scroll. */
const COLLAPSED_ROWS = 8;

function Change({ value }: { value: number }) {
  const color = value > 0 ? 'var(--color-success)' : value < 0 ? 'var(--color-danger)' : 'var(--color-text-tertiary)';
  return (
    <span className="text-[13px] font-semibold tabular-nums" style={{ color }}>
      {value === 0 ? '—' : `${value > 0 ? '+' : ''}${formatMoney(value)}`}
    </span>
  );
}

/**
 * Savings over time: the running balance charted by day, week or month, with every
 * bucket's balance editable.
 *
 * Editing a balance doesn't overwrite anything — it stores the difference as a
 * dated adjustment, so deposits and allocations entered later still move the
 * balance from that point on. That's what lets off-book money (cash, interest, a
 * transfer the tracker never saw) sit alongside the budgeted flows.
 */
export default function SavingsTrend({
  granularity,
  onGranularityChange,
  buckets,
  events,
  onSetBalance,
  adjustments,
  onAddAdjustment,
  onDeleteAdjustment,
}: {
  granularity: SavingsGranularity;
  onGranularityChange: (g: SavingsGranularity) => void;
  buckets: SavingsBucket[];
  events: SavingsEvent[];
  /** Target balance the user typed for a bucket. */
  onSetBalance: (bucket: SavingsBucket, target: number) => void;
  /** Hand entries inside the charted window, newest last. */
  adjustments: SavingsAdjustment[];
  onAddAdjustment: (date: string, amount: number, note: string) => void;
  onDeleteAdjustment: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draftDate, setDraftDate] = useState(() => toISODate(new Date()));
  const [draftAmount, setDraftAmount] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const noun = PERIOD_NOUN[granularity];
  const banked = buckets.filter((b) => !b.isFuture);
  const netOverWindow = buckets.reduce((s, b) => s + b.change, 0);
  const rows = [...buckets].reverse();
  const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);

  const submitAdjustment = () => {
    const amount = parseMoney(draftAmount);
    if (!amount) return;
    onAddAdjustment(draftDate, amount, draftNote.trim());
    setDraftAmount('');
    setDraftNote('');
    setAdding(false);
  };

  return (
    <div className="mt-4">
      {/* Granularity picker sits above the card it scopes */}
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
          Savings trend
        </h2>
        <div className="flex gap-1 rounded-xl p-0.5" style={{ background: 'var(--color-bg-surface)' }}>
          {GRANULARITIES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onGranularityChange(g)}
              aria-pressed={granularity === g}
              className="rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors"
              style={
                granularity === g
                  ? { background: 'var(--color-accent)', color: 'var(--color-accent-text)' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              {GRANULARITY_LABEL[g]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border p-4" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Balance by {noun}
          </span>
          <span className="text-[12px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
            {netOverWindow >= 0 ? '+' : ''}
            {formatMoney(netOverWindow)} over {buckets.length} {noun}
            {buckets.length === 1 ? '' : 's'}
          </span>
        </div>

        <SavingsTrendChart buckets={buckets} events={events} caption={`Savings balance by ${noun}`} periodNoun={noun} />

        {/* Table view — every plotted value, and the balance is editable here */}
        <div className="mt-2 border-t pt-1" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between gap-3 py-2">
            <span className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
              Edit balances
            </span>
            <span className="text-[11px] uppercase" style={{ letterSpacing: '0.06em', color: 'var(--color-text-tertiary)' }}>
              Change
            </span>
          </div>
          {visible.map((b) => (
            <div
              key={b.key}
              className="flex items-center justify-between gap-2 border-t py-2"
              style={{ borderColor: 'var(--color-border)', opacity: b.isFuture ? 0.6 : 1 }}
            >
              <span className="min-w-0 flex-1 truncate text-[14px]" style={{ color: 'var(--color-text-primary)' }}>
                {b.fullLabel}
                {b.isFuture && (
                  <span className="ml-1.5 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                    planned
                  </span>
                )}
              </span>
              <Change value={b.change} />
              <MoneyInput
                value={b.balance}
                size="sm"
                ariaLabel={`Balance on ${b.fullLabel}`}
                onSave={(n) => onSetBalance(b, n)}
              />
            </div>
          ))}
          {rows.length > COLLAPSED_ROWS && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="mt-1 w-full py-2 text-[13px] font-semibold"
              style={{ color: 'var(--color-accent)' }}
            >
              {expanded ? 'Show less' : `Show all ${rows.length} ${noun}s`}
            </button>
          )}
          <p className="mt-1 pb-1 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
            Typing a balance records the difference as an adjustment on that date — later deposits and allocations still move it.
          </p>
        </div>

        {/* Off-book entries: what the budget tracker never saw */}
        <div className="mt-1 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.06em', color: 'var(--color-text-secondary)' }}>
              Adjustments
            </span>
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              className="text-[13px] font-semibold"
              style={{ color: 'var(--color-accent)' }}
            >
              {adding ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {adding && (
            <div className="mt-2 flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-surface)' }}>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={draftDate}
                  onChange={(e) => setDraftDate(e.target.value)}
                  aria-label="Adjustment date"
                  className="flex-1 rounded-xl border px-3 text-[14px] outline-none"
                  style={{
                    height: '38px',
                    background: 'var(--color-bg-elevated)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <input
                  inputMode="decimal"
                  value={draftAmount}
                  onChange={(e) => setDraftAmount(e.target.value)}
                  placeholder="+100 / −40"
                  aria-label="Adjustment amount"
                  className="w-28 rounded-xl border px-3 text-right text-[14px] tabular-nums outline-none"
                  style={{
                    height: '38px',
                    background: 'var(--color-bg-elevated)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  placeholder="What was it?"
                  aria-label="Adjustment note"
                  className="min-w-0 flex-1 rounded-xl border px-3 text-[14px] outline-none"
                  style={{
                    height: '38px',
                    background: 'var(--color-bg-elevated)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                  }}
                />
                <button
                  type="button"
                  onClick={submitAdjustment}
                  className="rounded-xl px-4 text-[14px] font-semibold"
                  style={{ height: '38px', background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
                >
                  Save
                </button>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                A minus sign takes money out of savings.
              </span>
            </div>
          )}

          {adjustments.length === 0 ? (
            <p className="mt-1 text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
              None in this stretch — savings is tracking the budget exactly.
            </p>
          ) : (
            <div className="mt-1">
              {[...adjustments].reverse().map((a) => (
                <div key={a.id} className="flex items-center gap-2 border-t py-2" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]" style={{ color: 'var(--color-text-primary)' }}>
                      {a.note || (a.kind === 'balance' ? 'Balance edit' : 'Adjustment')}
                    </span>
                    <span className="block text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
                      {new Date(a.adj_date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </span>
                  <Change value={a.amount} />
                  <button
                    type="button"
                    onClick={() => onDeleteAdjustment(a.id)}
                    aria-label="Delete adjustment"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg active:opacity-70"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {banked.length === 0 && (
          <p className="mt-3 text-[12px]" style={{ color: 'var(--color-text-tertiary)' }}>
            This stretch is all in the future — the balances shown are planned.
          </p>
        )}
      </div>
    </div>
  );
}
