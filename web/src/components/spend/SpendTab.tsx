import { useState } from 'react';
import { useSpendEntries } from '../../hooks/useSpendEntries';
import {
  formatDateHeader,
  formatMoney,
  parseAmount,
  readDailyLimit,
  writeDailyLimit,
} from '../../lib/spend';
import Sheet from '../workout/program/Sheet';
import SpendEntryRow from './SpendEntryRow';

const inputStyle: React.CSSProperties = {
  height: 48,
  background: 'var(--color-bg-surface)',
  borderColor: 'var(--color-border)',
  color: 'var(--color-text-primary)',
};

/** The gear in the header — opens the daily-limit sheet. */
function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** "Daily spending limit" — a plain number, kept on this device. */
function LimitSheet({
  limit,
  onSave,
  onClose,
}: {
  limit: number | null;
  onSave: (next: number | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(limit == null ? '' : String(limit));

  return (
    <Sheet title="Daily spending limit" onClose={onClose}>
      <label className="block">
        <span
          className="mb-1.5 block text-[11px] font-medium uppercase"
          style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
        >
          Limit
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[17px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
            $
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="decimal"
            placeholder="No limit"
            autoFocus
            className="min-w-0 flex-1 rounded-xl border px-4 text-[15px] tabular-nums outline-none"
            style={inputStyle}
          />
        </div>
      </label>
      <p className="mt-2 text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Leave it empty for no limit. Saved on this device only.
      </p>

      <button
        type="button"
        onClick={() => {
          onSave(parseAmount(draft));
          onClose();
        }}
        className="mt-5 w-full rounded-full text-[15px] font-semibold active:scale-[0.98] active:opacity-85"
        style={{ height: 52, background: 'var(--color-accent)', color: 'var(--color-accent-text)' }}
      >
        Save
      </button>
    </Sheet>
  );
}

/**
 * The Spend tab: log what you spent in two taps, see today's total move the
 * moment you do, and scroll back through the last 30 days.
 *
 * Adds and deletes are optimistic in `useSpendEntries`, so every total on this
 * screen re-renders from the same in-memory list — nothing here refetches.
 */
export default function SpendTab({ userId }: { userId: string }) {
  const api = useSpendEntries(userId);
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [limit, setLimit] = useState<number | null>(() => readDailyLimit());
  const [limitOpen, setLimitOpen] = useState(false);

  const parsed = parseAmount(amount);
  const over = limit != null && api.todayTotal > limit;

  function add() {
    if (parsed == null) return;
    void api.addEntry(parsed, label);
    setAmount('');
    setLabel('');
  }

  function saveLimit(next: number | null) {
    setLimit(next);
    writeDailyLimit(next);
  }

  const totalColor = over
    ? 'var(--color-danger)'
    : limit != null
      ? 'var(--color-success)'
      : 'var(--color-text-primary)';

  return (
    <div
      className="ui-scope flex min-h-screen flex-col"
      style={{ background: 'var(--color-bg-base)' }}
    >
      <div className="pb-fab mx-auto flex w-full max-w-app flex-1 flex-col px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h1
            className="text-xl font-bold"
            style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
          >
            Spend
          </h1>
          <button
            type="button"
            onClick={() => setLimitOpen(true)}
            aria-label="Daily spending limit"
            className="-m-2 grid h-11 w-11 shrink-0 place-items-center rounded-full active:opacity-70"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <GearIcon />
          </button>
        </div>

        {/* --- quick add ---------------------------------------------------- */}
        <section
          className="flex flex-col gap-3 border p-4"
          style={{
            background: 'var(--color-bg-elevated)',
            borderColor: 'var(--color-border)',
            borderRadius: 16,
          }}
        >
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
            inputMode="decimal"
            placeholder="$0.00"
            aria-label="Amount"
            className="w-full rounded-xl border text-center text-[32px] font-bold tabular-nums outline-none"
            style={{
              ...inputStyle,
              height: 72,
              letterSpacing: '-0.02em',
            }}
          />
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add();
            }}
            placeholder="What was it for? (optional)"
            aria-label="Label"
            className="w-full rounded-xl border px-4 text-[15px] outline-none"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={add}
            disabled={parsed == null}
            className="w-full rounded-full text-[15px] font-semibold transition-opacity active:scale-[0.98] active:opacity-85 disabled:opacity-40"
            style={{
              height: 52,
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
            }}
          >
            Add
          </button>
        </section>

        {/* --- today's total ------------------------------------------------ */}
        <section className="py-8 text-center">
          <p
            className="text-[13px] font-medium uppercase"
            style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
          >
            Today
          </p>
          <p
            className="mt-1 text-[48px] font-bold tabular-nums"
            style={{ color: totalColor, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            {formatMoney(api.todayTotal)}
          </p>
          {over && limit != null && (
            <p className="mt-1 text-[13px] font-medium" style={{ color: 'var(--color-danger)' }}>
              Over daily limit by {formatMoney(api.todayTotal - limit)}
            </p>
          )}
        </section>

        {/* --- entries ------------------------------------------------------ */}
        {api.loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div key={i} className="skeleton h-24 rounded-2xl" />
            ))}
          </div>
        ) : api.days.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
              <path d="M12 17.5v-11" />
            </svg>
            <p className="mt-3 text-[17px]" style={{ color: 'var(--color-text-secondary)' }}>
              Nothing logged yet
            </p>
            <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Add what you spend as you go — it takes two taps.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {api.days.map((day) => (
              <section key={day.date}>
                <h2
                  className="mb-2 text-[13px] font-medium"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {formatDateHeader(day.date)}
                </h2>

                <div
                  className="overflow-hidden border"
                  style={{
                    background: 'var(--color-bg-elevated)',
                    borderColor: 'var(--color-border)',
                    borderRadius: 16,
                  }}
                >
                  {day.entries.map((e, i) => (
                    <div key={e.id}>
                      {i > 0 && (
                        <div style={{ height: 1, background: 'var(--color-border)' }} />
                      )}
                      <SpendEntryRow
                        entry={e}
                        onSave={(patch) => void api.updateEntry(e.id, patch)}
                        onDelete={() => void api.deleteEntry(e.id)}
                      />
                    </div>
                  ))}
                  <div style={{ height: 1, background: 'var(--color-border)' }} />
                  <p
                    className="px-4 py-2.5 text-right text-[13px] tabular-nums"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    Total: {formatMoney(day.total)}
                  </p>
                </div>
              </section>
            ))}

            {api.hasMore && (
              <button
                type="button"
                onClick={() => void api.loadMore()}
                disabled={api.loadingMore}
                className="w-full rounded-full border text-[13px] font-semibold active:opacity-70 disabled:opacity-50"
                style={{
                  height: 44,
                  borderColor: 'var(--color-border-strong)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {api.loadingMore ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>
        )}
      </div>

      {limitOpen && (
        <LimitSheet limit={limit} onSave={saveLimit} onClose={() => setLimitOpen(false)} />
      )}
    </div>
  );
}
