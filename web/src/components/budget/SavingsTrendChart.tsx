import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { formatMoney } from '../../types/budget';
import { compactMoney, eventsInBucket, niceTicks, type SavingsBucket, type SavingsEvent } from '../../lib/savingsSeries';

const PAD = { l: 48, r: 14, t: 14, b: 20 };
const PLOT_H = 132;
const H = PLOT_H + PAD.t + PAD.b;
const TOOLTIP_W = 176;

/** Track a block element's rendered width, so the plot can be laid out in real px. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Up to `count` evenly spaced indices across [0, n-1], always including both ends. */
function tickIndices(n: number, count: number): number[] {
  if (n <= count) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let k = 0; k < count; k++) out.add(Math.round((k * (n - 1)) / (count - 1)));
  return [...out].sort((a, b) => a - b);
}

/**
 * The savings balance over time — one series, so an area + line with a crosshair
 * read-out rather than anything more elaborate. Buckets after today are drawn
 * faded: those are planned deposits and allocations, not banked money.
 *
 * Every value here is also in the edit list below the chart, so the hover layer
 * enhances and never gates.
 */
export default function SavingsTrendChart({
  buckets,
  events,
  caption,
  periodNoun,
}: {
  buckets: SavingsBucket[];
  events: SavingsEvent[];
  /** What the plotted series is — stands in for a one-swatch legend. */
  caption: string;
  /** "day" / "week" / "month", for the read-out's change line. */
  periodNoun: string;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = buckets.length;

  // Keep the crosshair valid when the granularity (and so the bucket count) changes.
  useEffect(() => {
    setActive(null);
  }, [n, buckets[0]?.key]);

  if (n === 0) {
    return (
      <p className="py-8 text-center text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
        Nothing to chart yet — set a starting balance and what you put away each week.
      </p>
    );
  }

  const w = width || 320;
  const innerW = Math.max(1, w - PAD.l - PAD.r);
  const step = n > 1 ? innerW / (n - 1) : 0;
  const xAt = (i: number) => PAD.l + (n > 1 ? i * step : innerW / 2);

  // Y domain: padded around the data, never dipping below zero for an
  // all-positive balance.
  const values = buckets.map((b) => b.balance);
  const rawLo = Math.min(...values);
  const rawHi = Math.max(...values);
  const spread = rawHi - rawLo || Math.max(100, Math.abs(rawHi) * 0.2);
  let lo = rawLo - spread * 0.16;
  const hi = rawHi + spread * 0.16;
  if (rawLo >= 0) lo = Math.max(0, lo);
  const yAt = (v: number) => PAD.t + PLOT_H * (1 - (v - lo) / (hi - lo || 1));

  const baseY = PAD.t + PLOT_H;
  const path = (from: number, to: number) =>
    buckets
      .slice(from, to + 1)
      .map((b, k) => `${k === 0 ? 'M' : 'L'}${xAt(from + k).toFixed(1)},${yAt(b.balance).toFixed(1)}`)
      .join(' ');
  const area = (from: number, to: number) =>
    `${path(from, to)} L${xAt(to).toFixed(1)},${baseY} L${xAt(from).toFixed(1)},${baseY} Z`;

  let lastPast = -1;
  for (let i = 0; i < n; i++) if (!buckets[i].isFuture) lastPast = i;
  const hasPast = lastPast >= 0;
  const splitAt = hasPast ? lastPast : 0;

  const ticks = niceTicks(lo, hi, 3);
  const xTicks = tickIndices(n, n > 20 ? 5 : 6);
  const activeBucket = active != null ? buckets[active] : null;
  const activeEvents = activeBucket ? eventsInBucket(events, activeBucket).slice(0, 3) : [];

  const pickIndex = (clientX: number, el: SVGSVGElement) => {
    const rect = el.getBoundingClientRect();
    const i = step > 0 ? Math.round((clientX - rect.left - PAD.l) / step) : 0;
    setActive(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div ref={wrapRef} data-no-swipe className="relative" style={{ touchAction: 'pan-y' }}>
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`${caption}. ${buckets[splitAt]?.fullLabel ?? ''}: ${formatMoney(buckets[splitAt]?.balance ?? 0)}.`}
        tabIndex={0}
        className="block outline-none"
        onPointerDown={(e) => pickIndex(e.clientX, e.currentTarget)}
        onPointerMove={(e) => {
          if (e.pointerType === 'touch' && e.buttons === 0) return;
          pickIndex(e.clientX, e.currentTarget);
        }}
        onPointerLeave={() => setActive(null)}
        onPointerCancel={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? splitAt)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            setActive((a) => {
              const base = a ?? splitAt;
              return Math.max(0, Math.min(n - 1, base + (e.key === 'ArrowRight' ? 1 : -1)));
            });
          }
        }}
      >
        {/* Gridlines + y ticks */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={yAt(t)} y2={yAt(t)} stroke="var(--color-border)" strokeWidth="1" />
            <text
              x={PAD.l - 8}
              y={yAt(t) + 3.5}
              textAnchor="end"
              className="tabular-nums"
              style={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
            >
              {compactMoney(t)}
            </text>
          </g>
        ))}
        {lo < 0 && hi > 0 && (
          <line x1={PAD.l} x2={w - PAD.r} y1={yAt(0)} y2={yAt(0)} stroke="var(--color-border-strong)" strokeWidth="1" />
        )}

        {/* Planned tail first, so the banked line sits on top of it */}
        {splitAt < n - 1 && (
          <g opacity="0.45">
            <path d={area(splitAt, n - 1)} fill="var(--color-accent)" fillOpacity="0.1" />
            <path d={path(splitAt, n - 1)} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {hasPast && (
          <>
            <path d={area(0, splitAt)} fill="var(--color-accent)" fillOpacity="0.12" />
            <path d={path(0, splitAt)} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* X labels */}
        {xTicks.map((i) => (
          <text
            key={i}
            x={xAt(i)}
            y={H - 6}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            style={{ fontSize: 10, fill: 'var(--color-text-tertiary)' }}
          >
            {buckets[i].label}
          </text>
        ))}

        {/* Today's balance, direct-labelled — the one value worth reading without hovering */}
        {hasPast && (
          <>
            <circle
              cx={xAt(splitAt)}
              cy={yAt(buckets[splitAt].balance)}
              r="4.5"
              fill="var(--color-accent)"
              stroke="var(--color-bg-elevated)"
              strokeWidth="2"
            />
            {active == null && (
              <text
                x={Math.min(xAt(splitAt) + 10, w - PAD.r)}
                y={Math.max(yAt(buckets[splitAt].balance) - 10, PAD.t + 4)}
                textAnchor={xAt(splitAt) > w - 90 ? 'end' : 'start'}
                className="tabular-nums"
                style={{ fontSize: 11, fontWeight: 600, fill: 'var(--color-text-primary)' }}
              >
                {formatMoney(buckets[splitAt].balance)}
              </text>
            )}
          </>
        )}

        {/* Crosshair */}
        {activeBucket && (
          <>
            <line
              x1={xAt(active!)}
              x2={xAt(active!)}
              y1={PAD.t}
              y2={baseY}
              stroke="var(--color-border-strong)"
              strokeWidth="1"
            />
            <circle
              cx={xAt(active!)}
              cy={yAt(activeBucket.balance)}
              r="5"
              fill="var(--color-accent)"
              stroke="var(--color-bg-elevated)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>

      {/* Read-out */}
      {activeBucket && (
        <div
          className="pointer-events-none absolute rounded-xl border px-3 py-2 shadow-lg"
          style={{
            width: TOOLTIP_W,
            left: Math.max(0, Math.min(xAt(active!) - TOOLTIP_W / 2, w - TOOLTIP_W)),
            ...(yAt(activeBucket.balance) < PAD.t + PLOT_H / 2
              ? { top: yAt(activeBucket.balance) + 14 }
              : { bottom: H - yAt(activeBucket.balance) + 14 }),
            background: 'var(--color-bg-overlay)',
            borderColor: 'var(--color-border-strong)',
          }}
        >
          <span className="block text-[11px]" style={{ color: 'var(--color-text-secondary)' }}>
            {activeBucket.fullLabel}
            {activeBucket.isFuture ? ' · planned' : ''}
          </span>
          <span className="block text-[17px] font-bold tabular-nums" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
            {formatMoney(activeBucket.balance)}
          </span>
          <span
            className="block text-[12px] font-semibold tabular-nums"
            style={{
              color:
                activeBucket.change > 0
                  ? 'var(--color-success)'
                  : activeBucket.change < 0
                    ? 'var(--color-danger)'
                    : 'var(--color-text-tertiary)',
            }}
          >
            {activeBucket.change > 0 ? '+' : ''}
            {formatMoney(activeBucket.change)}{' '}
            <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400 }}>this {periodNoun}</span>
          </span>
          {activeEvents.map((e, i) => (
            <span key={i} className="mt-1 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="min-w-0 truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {e.label}
              </span>
              <span
                className="shrink-0 tabular-nums"
                style={{ color: e.delta >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
              >
                {e.delta > 0 ? '+' : ''}
                {formatMoney(e.delta)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
