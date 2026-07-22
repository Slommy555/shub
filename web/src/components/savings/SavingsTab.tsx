import { useMemo, useState } from 'react';
import { formatMoney, parseMoney, toISODate } from '../../types/budget';
import { useSavingsLedger, type LedgerKind } from '../../hooks/useSavingsLedger';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const IN_COLOR = 'var(--color-success)';
const OUT_COLOR = '#5c9eff';
const pad = (n: number) => String(n).padStart(2, '0');

function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Savings tab: a simplified, standalone savings tracker. A running balance up
 * top, a month calendar of every dated movement, and an agenda that shows each
 * put-away (money in) and payment (money out) with the balance after it. Reuses
 * the Budget tab's `.budget-scope` design tokens so it matches the rest of the app.
 */
export default function SavingsTab({ userId }: { userId: string }) {
  const ledger = useSavingsLedger(userId);
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const y = cursor.getFullYear();
  const m = cursor.getMonth(); // 0-based
  const ym = `${y}-${pad(m + 1)}`;
  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayISO = toISODate(new Date());

  const monthEntries = ledger.entries.filter((e) => e.entry_date.slice(0, 7) === ym);
  const byDay = useMemo(() => {
    const map = new Map<string, typeof ledger.entries>();
    for (const e of monthEntries) {
      const list = map.get(e.entry_date) ?? [];
      list.push(e);
      map.set(e.entry_date, list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ledger.entries, ym]);

  // Grid cells
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const isoFor = (d: number) => `${ym}-${pad(d)}`;

  const agendaDates = [...byDay.keys()].filter((d) => (selected ? d === selected : true)).sort();

  const shiftMonth = (dir: -1 | 1) => {
    setSelected(null);
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
  };

  const monthIn = monthEntries.filter((e) => e.kind === 'in').reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const monthOut = monthEntries.filter((e) => e.kind === 'out').reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return (
    <div className="budget-scope min-h-screen" style={{ background: 'var(--color-bg-base)', color: 'var(--color-text-primary)' }}>
      <div className="pb-fab mx-auto w-full max-w-app px-4 py-6 sm:px-6">
        <h1 className="mb-4 text-xl font-bold" style={{ letterSpacing: '-0.02em' }}>
          Savings
        </h1>

        {/* Balance */}
        <div className="mb-3 rounded-2xl border p-5" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
          <span className="mb-1 block text-xs font-medium uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
            Savings balance
          </span>
          <span className="text-3xl font-bold tabular-nums" style={{ color: ledger.balance >= 0 ? 'var(--color-text-primary)' : 'var(--color-danger)', letterSpacing: '-0.03em' }}>
            {formatMoney(ledger.balance)}
          </span>
        </div>

        {/* Totals */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border p-4" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
            <span className="mb-0.5 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Put away (all time)
            </span>
            <span className="text-lg font-bold tabular-nums" style={{ color: IN_COLOR, letterSpacing: '-0.02em' }}>
              +{formatMoney(ledger.totalIn)}
            </span>
          </div>
          <div className="rounded-2xl border p-4" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
            <span className="mb-0.5 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              Taken out (all time)
            </span>
            <span className="text-lg font-bold tabular-nums" style={{ color: OUT_COLOR, letterSpacing: '-0.02em' }}>
              −{formatMoney(ledger.totalOut)}
            </span>
          </div>
        </div>

        {/* Month navigator */}
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="grid h-11 w-11 place-items-center rounded-xl border active:opacity-80"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-[17px] font-semibold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {monthLabel}
          </span>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="grid h-11 w-11 place-items-center rounded-xl border active:opacity-80"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>

        {/* Calendar grid */}
        <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
          <div className="grid grid-cols-7">
            {WEEKDAYS.map((w, i) => (
              <div key={i} className="py-2 text-center text-[11px] font-semibold uppercase" style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}>
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d, i) => {
              if (d === null) return <div key={i} style={{ borderTop: '1px solid var(--color-border)' }} />;
              const iso = isoFor(d);
              const dayEntries = byDay.get(iso) ?? [];
              const isToday = iso === todayISO;
              const isSelected = iso === selected;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected((s) => (s === iso ? null : dayEntries.length ? iso : null))}
                  className="flex min-h-[58px] flex-col items-center gap-1 px-0.5 py-1.5 active:opacity-80"
                  style={{
                    borderTop: '1px solid var(--color-border)',
                    borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--color-border)',
                    background: isSelected ? 'var(--color-accent-subtle)' : 'transparent',
                  }}
                >
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full text-[13px] tabular-nums"
                    style={isToday ? { background: 'var(--color-accent)', color: 'var(--color-accent-text)', fontWeight: 700 } : { color: 'var(--color-text-primary)' }}
                  >
                    {d}
                  </span>
                  <span className="flex flex-wrap items-center justify-center gap-0.5">
                    {dayEntries.slice(0, 4).map((e, j) => (
                      <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: e.kind === 'in' ? IN_COLOR : OUT_COLOR }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Legend + this month's in/out */}
        <div className="mt-3 flex items-center justify-between px-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
          <span className="flex gap-4">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: IN_COLOR }} /> Put away
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: OUT_COLOR }} /> Payment
            </span>
          </span>
          <span className="tabular-nums">
            <span style={{ color: IN_COLOR }}>+{formatMoney(monthIn)}</span>
            {' · '}
            <span style={{ color: OUT_COLOR }}>−{formatMoney(monthOut)}</span>
          </span>
        </div>

        {/* Add entry */}
        {adding ? (
          <AddEntryForm
            onCancel={() => setAdding(false)}
            onAdd={(kind, amount, date, note) => {
              void ledger.addEntry(kind, amount, date, note);
              setAdding(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 w-full rounded-xl border py-2.5 text-sm font-semibold"
            style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', minHeight: '46px' }}
          >
            + Add to savings / record a payment
          </button>
        )}

        {/* Agenda */}
        <div className="mt-6 mb-2 flex items-center justify-between">
          <h2 className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
            {selected ? dayLabel(selected) : monthLabel}
          </h2>
          {selected && (
            <button type="button" onClick={() => setSelected(null)} className="text-[12px] font-semibold active:opacity-70" style={{ color: 'var(--color-accent)' }}>
              All month
            </button>
          )}
        </div>

        {agendaDates.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-2xl border px-4 py-8 text-center text-[15px]"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
          >
            {ledger.loading ? 'Loading…' : `Nothing ${selected ? 'this day' : 'this month'} yet`}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {agendaDates.map((date) => (
              <div key={date}>
                <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                  {dayLabel(date)}
                </span>
                <div className="flex flex-col gap-2">
                  {(byDay.get(date) ?? []).map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.kind === 'in' ? IN_COLOR : OUT_COLOR }} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                          {e.note || (e.kind === 'in' ? 'Put away' : 'Payment')}
                        </span>
                        <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-tertiary)' }}>
                          Balance {formatMoney(ledger.runningBalance[e.id] ?? 0)}
                        </span>
                      </span>
                      <span
                        className="shrink-0 text-[15px] font-semibold tabular-nums"
                        style={{ color: e.kind === 'in' ? IN_COLOR : OUT_COLOR, letterSpacing: '-0.02em' }}
                      >
                        {e.kind === 'in' ? '+' : '−'}
                        {formatMoney(Number(e.amount) || 0)}
                      </span>
                      <button
                        type="button"
                        aria-label="Delete entry"
                        onClick={() => {
                          if (window.confirm('Delete this entry?')) void ledger.deleteEntry(e.id);
                        }}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg active:opacity-70"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** The inline "add a movement" form: put-away vs payment, amount, date, note. */
function AddEntryForm({
  onAdd,
  onCancel,
}: {
  onAdd: (kind: LedgerKind, amount: number, date: string, note: string) => void;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<LedgerKind>('in');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => toISODate(new Date()));
  const [note, setNote] = useState('');

  const submit = () => {
    const amt = parseMoney(amount);
    if (!(amt > 0) || !date) return;
    onAdd(kind, amt, date, note);
  };

  const field = {
    height: '46px',
    background: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
  } as const;

  return (
    <div className="mt-4 flex flex-col gap-2 rounded-2xl border p-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
      {/* In / Out toggle */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg-surface)' }}>
        {(
          [
            { id: 'in', label: 'Put away' },
            { id: 'out', label: 'Payment' },
          ] as const
        ).map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setKind(o.id)}
            className="flex-1 rounded-lg py-2 text-sm font-semibold transition-colors"
            style={kind === o.id ? { background: 'var(--color-accent)', color: 'var(--color-accent-text)' } : { color: 'var(--color-text-secondary)' }}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          autoFocus
          inputMode="decimal"
          placeholder="$0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-28 rounded-xl border px-3 text-right text-base tabular-nums outline-none"
          style={field}
        />
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border px-3 text-base outline-none"
          style={field}
        />
      </div>

      <input
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="rounded-xl border px-3 text-base outline-none"
        style={field}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
          style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)', background: 'var(--color-bg-surface)', minHeight: '46px' }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded-xl py-2.5 text-sm font-semibold"
          style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', minHeight: '46px' }}
        >
          {kind === 'in' ? 'Add to savings' : 'Record payment'}
        </button>
      </div>
    </div>
  );
}
