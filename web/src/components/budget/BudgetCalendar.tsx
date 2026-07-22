import { useState } from 'react';
import { formatMoney, toISODate } from '../../types/budget';

export type CalEventKind = 'pay' | 'fixed' | 'scheduled' | 'card';

export interface CalEvent {
  /** YYYY-MM-DD the event lands on. */
  date: string;
  kind: CalEventKind;
  label: string;
  amount: number;
  color: string;
}

interface Props {
  /** First day (YYYY-MM-01) of the month in view. */
  monthStart: string;
  monthLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  /** All dated events in (roughly) this month. */
  events: CalEvent[];
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "Thu, Jul 30" from YYYY-MM-DD. */
function dayLabel(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Month calendar for the Budget tab: plots pay days (income) and every dated
 * outflow — fixed-cost charge days, scheduled one-off expenses, and credit-card
 * due dates — as colored markers, with a running in/out summary and a tappable
 * agenda. Tap a day to focus its events; tap again (or "All month") to clear.
 */
export default function BudgetCalendar({ monthStart, monthLabel, onPrevMonth, onNextMonth, events }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [y, m] = monthStart.split('-').map(Number);
  const ym = monthStart.slice(0, 7);
  const todayISO = toISODate(new Date());

  // Only events inside this calendar month drive the grid + totals.
  const monthEvents = events.filter((e) => e.date.slice(0, 7) === ym);
  const byDay = new Map<string, CalEvent[]>();
  for (const e of monthEvents) {
    const list = byDay.get(e.date) ?? [];
    list.push(e);
    byDay.set(e.date, list);
  }

  const income = monthEvents.filter((e) => e.kind === 'pay').reduce((s, e) => s + e.amount, 0);
  const outflow = monthEvents.filter((e) => e.kind !== 'pay').reduce((s, e) => s + e.amount, 0);

  // Grid cells: leading blanks for the first-of-month weekday, then the days,
  // padded to whole weeks.
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const isoFor = (d: number) => `${ym}-${pad(d)}`;

  const agendaDates = [...byDay.keys()]
    .filter((d) => (selected ? d === selected : true))
    .sort();

  return (
    <div>
      {/* Month navigator */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={onPrevMonth}
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
          onClick={onNextMonth}
          className="grid h-11 w-11 place-items-center rounded-xl border active:opacity-80"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* In / out summary */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border p-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
          <span className="mb-0.5 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Coming in
          </span>
          <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-success)', letterSpacing: '-0.02em' }}>
            {formatMoney(income)}
          </span>
        </div>
        <div className="rounded-2xl border p-3" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
          <span className="mb-0.5 block text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            Going out
          </span>
          <span className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {formatMoney(outflow)}
          </span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}>
        <div className="grid grid-cols-7">
          {WEEKDAYS.map((w, i) => (
            <div
              key={i}
              className="py-2 text-center text-[11px] font-semibold uppercase"
              style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
            >
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            if (d === null) return <div key={i} style={{ borderTop: '1px solid var(--color-border)' }} />;
            const iso = isoFor(d);
            const dayEvents = byDay.get(iso) ?? [];
            const isToday = iso === todayISO;
            const isSelected = iso === selected;
            const hasPay = dayEvents.some((e) => e.kind === 'pay');
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelected((s) => (s === iso ? null : dayEvents.length ? iso : null))}
                className="flex min-h-[58px] flex-col items-center gap-1 px-0.5 py-1.5 active:opacity-80"
                style={{
                  borderTop: '1px solid var(--color-border)',
                  borderLeft: i % 7 === 0 ? 'none' : '1px solid var(--color-border)',
                  background: isSelected ? 'var(--color-accent-subtle)' : hasPay ? 'var(--color-success-subtle, transparent)' : 'transparent',
                }}
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-full text-[13px] tabular-nums"
                  style={
                    isToday
                      ? { background: 'var(--color-accent)', color: 'var(--color-accent-text)', fontWeight: 700 }
                      : { color: 'var(--color-text-primary)' }
                  }
                >
                  {d}
                </span>
                <span className="flex flex-wrap items-center justify-center gap-0.5">
                  {dayEvents.slice(0, 4).map((e, j) => (
                    <span key={j} className="h-1.5 w-1.5 rounded-full" style={{ background: e.color }} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 px-1 text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
        <LegendDot color="var(--color-success)" label="Paycheck" />
        <LegendDot color="#8b8aa8" label="Fixed cost" />
        <LegendDot color="#f0a04b" label="Scheduled" />
        <LegendDot color="#5c9eff" label="Card due" />
      </div>

      {/* Agenda */}
      <div className="mt-5 mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase" style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}>
          {selected ? dayLabel(selected) : `Everything in ${monthLabel}`}
        </h2>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-[12px] font-semibold active:opacity-70"
            style={{ color: 'var(--color-accent)' }}
          >
            All month
          </button>
        )}
      </div>

      {agendaDates.length === 0 ? (
        <div
          className="flex items-center justify-center rounded-2xl border px-4 py-8 text-center text-[15px]"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)', color: 'var(--color-text-tertiary)' }}
        >
          Nothing dated {selected ? 'this day' : 'this month'}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {agendaDates.map((date) => (
            <div key={date}>
              <span className="mb-1.5 block text-[12px] font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                {dayLabel(date)}
              </span>
              <div className="flex flex-col gap-2">
                {(byDay.get(date) ?? [])
                  .slice()
                  .sort((a, b) => (a.kind === 'pay' ? -1 : b.kind === 'pay' ? 1 : 0))
                  .map((e, j) => (
                    <div
                      key={j}
                      className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                        {e.label}
                        {e.kind === 'card' && <span className="ml-1 text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>due</span>}
                      </span>
                      <span
                        className="shrink-0 text-[15px] font-semibold tabular-nums"
                        style={{ color: e.kind === 'pay' ? 'var(--color-success)' : 'var(--color-text-primary)', letterSpacing: '-0.02em' }}
                      >
                        {e.kind === 'pay' ? '+' : ''}
                        {formatMoney(e.amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
