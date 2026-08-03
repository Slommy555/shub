import { useEffect, useRef, useState } from 'react';
import {
  analyzeMeal,
  MealParseError,
  totalOf,
  type AnalyzeStage,
} from '../../lib/mealDescribe';
import type { Macros, MacroSource, MealItem } from '../../types/nutrition';

type Stage = 'idle' | 'analyzing' | 'result' | 'error';

const PLACEHOLDER = `Describe what you ate…
e.g. "a Big Mac and medium fries" or "200g grilled chicken with a cup of white rice and some broccoli"`;

const STATUS: Record<AnalyzeStage, string> = {
  identifying: 'Identifying foods…',
  'looking-up': 'Looking up nutrition data…',
  calculating: 'Calculating macros…',
};

const PARSE_ERROR =
  "Couldn't identify foods in that description. Try being more specific — e.g. " +
  "'200g chicken breast and 1 cup white rice' instead of 'my lunch'";
const LOOKUP_ERROR =
  'Having trouble looking up these items. Check your connection and try again.';

/**
 * Where the row's numbers came from. Green USDA and blue Open Food Facts are
 * real database rows; amber flags a Claude guess so it reads as the exception.
 */
const BADGE: Record<MacroSource, { label: string; color: string; title?: string }> = {
  usda: { label: 'USDA', color: 'var(--color-success)' },
  open_food_facts: { label: 'Open Food Facts', color: 'var(--color-info)' },
  estimate: {
    label: 'Estimated',
    color: 'var(--color-warning)',
    title: 'Claude estimate — verify if accuracy matters',
  },
};

const MACRO_FIELDS: { key: keyof Macros; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
];

const g = (n: number) => (Math.round(n * 10) / 10).toString();

function SourceBadge({ source }: { source: MacroSource }) {
  const badge = BADGE[source];
  return (
    <span
      title={badge.title}
      className="inline-flex shrink-0 items-center rounded-full px-2.5 text-[11px] font-medium"
      style={{
        height: 22,
        letterSpacing: '0.02em',
        // A tint of the source color rather than a solid fill — the badge is
        // metadata, and shouldn't out-weigh the macro numbers beside it.
        background: `color-mix(in srgb, ${badge.color} 16%, transparent)`,
        color: badge.color,
      }}
    >
      {badge.label}
    </span>
  );
}

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

/**
 * One breakdown row. Collapsed it's a summary; tapping expands editable inputs
 * for the quantity and all four macros, so anything the lookup got wrong can be
 * fixed before the meal is logged.
 */
function ItemRow({
  item,
  open,
  onToggle,
  onChange,
}: {
  item: MealItem;
  open: boolean;
  onToggle: () => void;
  onChange: (next: MealItem) => void;
}) {
  const setNum = (key: keyof Macros, raw: string) => {
    const n = raw === '' ? 0 : parseFloat(raw);
    onChange({ ...item, [key]: Number.isFinite(n) && n >= 0 ? n : 0 });
  };

  return (
    <div
      className="rounded-xl border"
      style={{
        background: open ? 'var(--color-bg-surface)' : 'transparent',
        borderColor: open ? 'var(--color-border-strong)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[15px] font-medium"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {item.name}
            <span style={{ color: 'var(--color-text-tertiary)' }}> · {item.quantity_display}</span>
          </span>
          <span
            className="mt-1 flex flex-wrap items-center gap-2 text-[13px] tabular-nums"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <span>
              P: {g(item.protein_g)}g · C: {g(item.carbs_g)}g · F: {g(item.fat_g)}g
            </span>
            <SourceBadge source={item.source} />
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <span
            className="text-[15px] font-semibold tabular-nums"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {Math.round(item.calories).toLocaleString()}
          </span>
          <span style={{ color: 'var(--color-text-tertiary)' }}>
            <ChevronIcon open={open} />
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-2 px-3 pb-3">
          {item.matched_name && (
            <p className="text-[11px]" style={{ color: 'var(--color-text-tertiary)' }}>
              Matched: {item.matched_name}
            </p>
          )}
          <label className="flex items-center gap-3">
            <span className="flex-1 text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
              Quantity
            </span>
            <input
              value={item.quantity_display}
              onChange={(e) => onChange({ ...item, quantity_display: e.target.value })}
              aria-label={`Quantity of ${item.name}`}
              className="w-32 shrink-0 rounded-xl border px-3 text-right text-[15px] outline-none"
              style={{
                background: 'var(--color-bg-elevated)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
                height: 44,
              }}
            />
          </label>
          {MACRO_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center gap-3">
              <span className="flex-1 text-[15px]" style={{ color: 'var(--color-text-secondary)' }}>
                {f.label}
              </span>
              <div className="relative w-32 shrink-0">
                <input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={String(item[f.key])}
                  onChange={(e) => setNum(f.key, e.target.value)}
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label={`${f.label} for ${item.name}`}
                  className="w-full rounded-xl border px-3 text-right text-[15px] font-semibold tabular-nums outline-none"
                  style={{
                    background: 'var(--color-bg-elevated)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                    height: 44,
                    paddingRight: f.unit ? 26 : 12,
                  }}
                />
                {f.unit && (
                  <span
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px]"
                    style={{ color: 'var(--color-text-tertiary)' }}
                  >
                    {f.unit}
                  </span>
                )}
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The second way into the Nutrition tab: type what you ate in plain language.
 * Claude splits it into items, each is looked up in USDA or Open Food Facts,
 * and the breakdown lands as one editable row per food — logged as separate
 * entries so the day's history stays itemised.
 */
export default function MealDescriber({
  onAddAll,
}: {
  onAddAll: (entries: (Macros & { food_name: string; serving_size: string | null })[]) => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<AnalyzeStage>('identifying');
  const [items, setItems] = useState<MealItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // A stale analysis must not overwrite the screen after a "Try again".
  const runId = useRef(0);

  const reset = (keepText = false) => {
    runId.current++;
    if (!keepText) setText('');
    setItems([]);
    setOpenId(null);
    setErrorText(null);
    setStage('idle');
  };

  async function analyze() {
    const description = text.trim();
    if (!description) return;
    const run = ++runId.current;
    setStatus('identifying');
    setStage('analyzing');
    try {
      const result = await analyzeMeal(description, (s) => {
        if (runId.current === run) setStatus(s);
      });
      if (runId.current !== run) return;
      setItems(result);
      setOpenId(null);
      setStage('result');
    } catch (err) {
      if (runId.current !== run) return;
      setErrorText(err instanceof MealParseError ? PARSE_ERROR : LOOKUP_ERROR);
      setStage('error');
    }
  }

  function addAll() {
    if (items.length === 0) return;
    onAddAll(
      items.map((it) => ({
        food_name: it.name,
        calories: it.calories,
        protein_g: it.protein_g,
        carbs_g: it.carbs_g,
        fat_g: it.fat_g,
        serving_size: it.quantity_display || null,
      }))
    );
    reset();
  }

  const total = totalOf(items);

  return (
    <section className="mt-6">
      <Divider />

      {stage === 'idle' && (
        <div className="mt-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="Describe your meal"
            rows={4}
            className="w-full resize-y rounded-xl border px-4 py-3 text-[15px] leading-relaxed outline-none"
            style={{
              background: 'var(--color-bg-surface)',
              borderColor: 'var(--color-border)',
              color: 'var(--color-text-primary)',
              minHeight: 108,
            }}
          />
          <button
            type="button"
            onClick={() => void analyze()}
            disabled={!text.trim()}
            className="w-full rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-50"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
              height: 52,
            }}
          >
            Analyze Meal
          </button>
        </div>
      )}

      {stage === 'analyzing' && <LoadingCard status={STATUS[status]} />}

      {stage === 'result' && (
        <div
          className="mt-4 rounded-2xl border p-4 sm:p-5"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          <p
            className="text-[11px] font-semibold uppercase"
            style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
          >
            Your meal breakdown
          </p>

          <div
            className="mt-3 space-y-1 border-t pt-2"
            style={{ borderColor: 'var(--color-border)' }}
          >
            {items.map((it) => (
              <ItemRow
                key={it.id}
                item={it}
                open={openId === it.id}
                onToggle={() => setOpenId((prev) => (prev === it.id ? null : it.id))}
                onChange={(next) =>
                  setItems((prev) => prev.map((p) => (p.id === next.id ? next : p)))
                }
              />
            ))}
          </div>

          <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-baseline justify-between gap-3">
              <span
                className="text-[11px] font-semibold uppercase"
                style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
              >
                Total
              </span>
              <span
                className="text-[17px] font-semibold tabular-nums"
                style={{ color: 'var(--color-text-primary)' }}
              >
                {Math.round(total.calories).toLocaleString()} cal
              </span>
            </div>
            <p
              className="mt-1 text-right text-[13px] tabular-nums"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              P: {g(total.protein_g)}g · C: {g(total.carbs_g)}g · F: {g(total.fat_g)}g
            </p>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => reset(true)}
              className="rounded-full border px-5 text-[13px] font-semibold"
              style={{
                borderColor: 'var(--color-border-strong)',
                color: 'var(--color-text-secondary)',
                height: 48,
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={addAll}
              className="flex-1 rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98]"
              style={{
                background: 'var(--color-accent)',
                color: 'var(--color-accent-text)',
                height: 48,
              }}
            >
              Add all to my day
            </button>
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div
          className="mt-4 rounded-2xl border p-5 text-center"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          <p className="text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
            {errorText}
          </p>
          <button
            type="button"
            onClick={() => reset(true)}
            className="mt-4 rounded-full px-6 text-[15px] font-semibold"
            style={{
              background: 'var(--color-accent)',
              color: 'var(--color-accent-text)',
              height: 48,
            }}
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
}

/** The "OR" rule that separates the two ways of logging a meal. */
function Divider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
      <span
        className="text-[11px] font-medium uppercase"
        style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
      >
        or
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--color-border)' }} />
    </div>
  );
}

/**
 * Skeleton rows plus a status line that changes as the pipeline advances. The
 * text cross-fades rather than snapping, so a fast stage change doesn't flicker.
 */
function LoadingCard({ status }: { status: string }) {
  const [shown, setShown] = useState(status);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (status === shown) return;
    setVisible(false);
    const t = window.setTimeout(() => {
      setShown(status);
      setVisible(true);
    }, 200);
    return () => window.clearTimeout(t);
  }, [status, shown]);

  return (
    <div
      className="mt-4 rounded-2xl border p-4 sm:p-5"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <p
        aria-live="polite"
        className="text-[13px]"
        style={{
          color: 'var(--color-text-secondary)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      >
        {shown}
      </p>
      <div className="mt-3 space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-1">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="skeleton h-4 rounded" style={{ width: `${70 - i * 8}%` }} />
              <div className="skeleton h-3 w-2/5 rounded" />
            </div>
            <div className="skeleton h-5 w-12 shrink-0 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
