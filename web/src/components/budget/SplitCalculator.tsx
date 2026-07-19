import { useState } from 'react';
import { formatMoney, parseMoney } from '../../types/budget';

/**
 * A tiny standalone helper (not tied to any expense): enter a total and a number
 * of weeks to see the per-week amount. Collapsed to a single button by default.
 */
export default function SplitCalculator() {
  const [open, setOpen] = useState(false);
  const [total, setTotal] = useState('');
  const [weeks, setWeeks] = useState('');

  const totalN = parseMoney(total);
  const weeksN = Math.max(0, Math.floor(parseMoney(weeks)));
  const perWeek = weeksN > 0 ? totalN / weeksN : 0;

  const fieldStyle = {
    height: '48px',
    background: 'var(--color-bg-surface)',
    borderColor: 'var(--color-border)',
    color: 'var(--color-text-primary)',
  } as const;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 w-full rounded-full border py-3 text-sm font-semibold"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)', minHeight: '48px' }}
      >
        Split calculator
      </button>
    );
  }

  return (
    <div
      className="mt-3 rounded-2xl border p-4"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          Split calculator
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Close
        </button>
      </div>

      <div className="flex items-end gap-3">
        <label className="flex-1">
          <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Total
          </span>
          <input
            inputMode="decimal"
            placeholder="$0.00"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-full rounded-xl border px-3 text-base tabular-nums outline-none"
            style={fieldStyle}
          />
        </label>
        <span className="pb-3 text-sm" style={{ color: 'var(--color-text-tertiary)' }}>
          ÷
        </span>
        <label className="w-24">
          <span className="mb-1.5 block text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            Weeks
          </span>
          <input
            inputMode="numeric"
            placeholder="0"
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            className="w-full rounded-xl border px-3 text-base tabular-nums outline-none"
            style={fieldStyle}
          />
        </label>
      </div>

      <div
        className="mt-3 flex items-center justify-between rounded-xl px-3 py-3"
        style={{ background: 'var(--color-bg-surface)' }}
      >
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Per week
        </span>
        <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)' }}>
          {formatMoney(perWeek)}
        </span>
      </div>
    </div>
  );
}
