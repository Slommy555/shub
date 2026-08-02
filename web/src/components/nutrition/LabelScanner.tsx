import { useEffect, useRef, useState } from 'react';
import MacroResultCard, { type MacroDraft } from './MacroResultCard';
import { MAX_IMAGES, prepareImage, scanLabels, type PreparedImage } from '../../lib/nutritionScan';
import type { Macros, ScanItem } from '../../types/nutrition';

type Stage = 'idle' | 'selected' | 'scanning' | 'result' | 'error';

/** A picked label: the prepared image plus what the user ate of THAT one. */
interface Shot extends PreparedImage {
  id: string;
  amount: string;
}

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const CameraIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
    <path d="M14.5 4h-5L8 6.5H5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

const UploadIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M12 16V3M7.5 7.5 12 3l4.5 4.5" />
  </svg>
);

const CloseIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const round = (n: number) => Math.round(n);

/**
 * The scan flow: add one or more label photos, say how much you ate of each,
 * then Claude scales every label to its own amount and the totals are summed.
 * Photos are never uploaded anywhere but the one Claude call.
 */
export default function LabelScanner({
  onAdd,
}: {
  onAdd: (entry: Macros & { food_name: string; serving_size: string | null }) => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [shots, setShots] = useState<Shot[]>([]);
  const [draft, setDraft] = useState<MacroDraft | null>(null);
  const [items, setItems] = useState<ScanItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  /** The serving text at scan time — the inputs are gone by the result stage. */
  const [scannedServing, setScannedServing] = useState<string | null>(null);

  // Meal prep: the amounts describe a whole batch, and only one portion of it
  // gets logged. `makes` / `eating` are the divisor and numerator of that share.
  const [mealPrep, setMealPrep] = useState(false);
  const [makes, setMakes] = useState(5);
  const [eating, setEating] = useState(1);
  /** Snapshot of the batch at scan time, so the result card can show the math. */
  const [batch, setBatch] = useState<{ total: Macros; makes: number; eating: number } | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // Object URLs stay valid until revoked. Removing a shot revokes its own; this
  // catches whatever is still open when the tab unmounts.
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;
  useEffect(
    () => () => {
      shotsRef.current.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    },
    []
  );

  function clearShots() {
    shots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
    setShots([]);
  }

  function reset(keepShots = false) {
    if (!keepShots) clearShots();
    setDraft(null);
    setItems([]);
    setWarning(null);
    setErrorText(null);
    setScannedServing(null);
    setBatch(null);
    if (!keepShots) setMealPrep(false);
    setStage(keepShots && shots.length > 0 ? 'selected' : 'idle');
  }

  function removeShot(id: string) {
    setShots((prev) => {
      const gone = prev.find((s) => s.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      const next = prev.filter((s) => s.id !== id);
      if (next.length === 0) setStage('idle');
      // Meal prep only makes sense for a multi-ingredient batch.
      if (next.length < 2) setMealPrep(false);
      return next;
    });
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setErrorText(null);
    try {
      const prepared = await prepareImage(file, () => setPreparing(true));
      setShots((prev) => [...prev, { ...prepared, id: crypto.randomUUID(), amount: '' }]);
      setStage('selected');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not read that image.');
      setStage('error');
    } finally {
      setPreparing(false);
    }
  }

  async function scan() {
    if (shots.length === 0) return;
    // Freeze the batch split now so later edits to the inputs can't retroactively
    // disagree with the numbers already on the card.
    const prep = mealPrep && shots.length > 1;
    const nMakes = Math.max(1, Math.round(makes) || 1);
    const nEating = Math.max(1, Math.round(eating) || 1);
    const share = prep ? nEating / nMakes : 1;

    const amounts = shots
      .map((s) => s.amount.trim())
      .filter(Boolean)
      .join(' · ');
    setScannedServing(
      prep
        ? `${nEating} of ${nMakes} servings${amounts ? ` — ${amounts}` : ''}`
        : amounts || null
    );
    setStage('scanning');
    try {
      const res = await scanLabels(
        shots.map((s) => ({ image: s, amount: s.amount })),
        { mealPrep: prep }
      );
      setDraft({
        food_name: res.food_name,
        calories: round(res.calories * share),
        protein_g: round(res.protein_g * share),
        carbs_g: round(res.carbs_g * share),
        fat_g: round(res.fat_g * share),
      });
      setBatch(
        prep
          ? {
              total: {
                calories: res.calories,
                protein_g: res.protein_g,
                carbs_g: res.carbs_g,
                fat_g: res.fat_g,
              },
              makes: nMakes,
              eating: nEating,
            }
          : null
      );
      setItems(res.items);
      setWarning(
        res.note ?? (res.confidence === 'low' ? 'Low confidence — double-check these numbers.' : null)
      );
      setStage('result');
    } catch {
      setErrorText(
        shots.length === 1
          ? "Couldn't read this label — try a clearer photo or better lighting"
          : "Couldn't read these labels — try clearer photos or better lighting"
      );
      setStage('error');
    }
  }

  function add() {
    if (!draft) return;
    onAdd({ ...draft, serving_size: scannedServing });
    reset();
  }

  const atCap = shots.length >= MAX_IMAGES;

  /**
   * `large` is the empty-state pair of 140px cards; `small` is the "add another
   * label" row that sits under the shots once at least one is picked.
   */
  const pickButton = (kind: 'camera' | 'upload', variant: 'large' | 'small') => {
    const isCamera = kind === 'camera';
    const Icon = isCamera ? CameraIcon : UploadIcon;
    const ref = isCamera ? cameraRef : uploadRef;
    const big = variant === 'large';
    return (
      <button
        key={kind}
        type="button"
        onClick={() => ref.current?.click()}
        disabled={atCap}
        className={[
          'flex items-center justify-center gap-2 border transition-transform active:scale-[0.98] disabled:opacity-50',
          big ? 'flex-col rounded-2xl' : 'flex-1 rounded-xl text-[13px] font-semibold',
        ].join(' ')}
        style={{
          background: 'var(--color-bg-elevated)',
          borderColor: 'var(--color-border)',
          height: big ? 140 : 48,
        }}
      >
        <span style={{ color: 'var(--color-text-secondary)' }}>
          <Icon size={big ? 28 : 18} />
        </span>
        <span
          className={big ? 'text-[15px] font-semibold' : ''}
          style={{ color: 'var(--color-text-primary)' }}
        >
          {isCamera ? (big ? 'Take Photo' : 'Add Photo') : big ? 'Upload Image' : 'Upload'}
        </span>
      </button>
    );
  };

  return (
    <section className="mt-4">
      {/* Both inputs stay mounted so the hidden file pickers keep their refs.
          `multiple` lets the picker add several labels in one go. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []).slice(0, MAX_IMAGES - shots.length);
          e.target.value = '';
          for (const f of files) await pick(f);
        }}
      />

      {stage === 'idle' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pickButton('camera', 'large')}
          {pickButton('upload', 'large')}
        </div>
      )}

      {stage === 'selected' && (
        <div className="space-y-3">
          {shots.map((shot, i) => (
            <div
              key={shot.id}
              className="overflow-hidden rounded-2xl border"
              style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
            >
              <div className="relative">
                <img
                  src={shot.previewUrl}
                  alt={`Nutrition label ${i + 1}`}
                  className="mx-auto block max-h-[250px] w-full object-contain sm:max-h-[300px]"
                />
                {shots.length > 1 && (
                  <span
                    className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                  >
                    Label {i + 1}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeShot(shot.id)}
                  aria-label={`Remove label ${i + 1}`}
                  className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full"
                  style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
                >
                  {CloseIcon}
                </button>
              </div>
              <div className="p-3">
                <input
                  value={shot.amount}
                  onChange={(e) =>
                    setShots((prev) =>
                      prev.map((s) => (s.id === shot.id ? { ...s, amount: e.target.value } : s))
                    )
                  }
                  placeholder={
                    mealPrep
                      ? 'Amount in the batch — e.g. 500g, 2 cups, the whole bag'
                      : 'Amount eaten — e.g. 1 cup, 100g, 1/5th of this'
                  }
                  aria-label={
                    mealPrep
                      ? `Amount of ingredient ${i + 1} in the batch`
                      : `Amount eaten of label ${i + 1}`
                  }
                  className="w-full rounded-xl border px-4 text-[15px] outline-none"
                  style={{
                    background: 'var(--color-bg-surface)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text-primary)',
                    height: 48,
                  }}
                />
              </div>
            </div>
          ))}

          {atCap ? (
            <p className="text-center text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
              {MAX_IMAGES} labels is the limit for one scan.
            </p>
          ) : (
            <div className="flex gap-2">
              {pickButton('camera', 'small')}
              {pickButton('upload', 'small')}
            </div>
          )}

          {shots.length > 1 && (
            <div
              className="rounded-2xl border p-3"
              style={{
                background: mealPrep ? 'var(--color-accent-subtle)' : 'var(--color-bg-elevated)',
                borderColor: mealPrep ? 'var(--color-accent-muted)' : 'var(--color-border)',
              }}
            >
              <button
                type="button"
                onClick={() => setMealPrep((v) => !v)}
                aria-pressed={mealPrep}
                className="flex w-full items-center gap-3 text-left"
              >
                <span
                  className="grid h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors"
                  style={{
                    background: mealPrep ? 'var(--color-accent)' : 'var(--color-border-strong)',
                  }}
                >
                  <span
                    className="h-5 w-5 rounded-full bg-white transition-transform"
                    style={{ transform: mealPrep ? 'translateX(16px)' : 'translateX(0)' }}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className="block text-[15px] font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Meal prep
                  </span>
                  <span className="block text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                    Log one portion of a batch you cooked
                  </span>
                </span>
              </button>

              {mealPrep && (
                <div className="mt-3 space-y-2">
                  {[
                    { label: 'Batch makes', value: makes, set: setMakes, unit: 'servings' },
                    { label: "You're eating", value: eating, set: setEating, unit: 'servings' },
                  ].map((row) => (
                    <label key={row.label} className="flex items-center gap-3">
                      <span
                        className="flex-1 text-[15px]"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {row.label}
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        value={String(row.value)}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          row.set(Number.isFinite(n) && n > 0 ? n : 1);
                        }}
                        onFocus={(e) => e.currentTarget.select()}
                        className="w-20 shrink-0 rounded-xl border px-3 text-right text-[15px] font-semibold tabular-nums outline-none"
                        style={{
                          background: 'var(--color-bg-surface)',
                          borderColor: 'var(--color-border)',
                          color: 'var(--color-text-primary)',
                          height: 44,
                        }}
                      />
                      <span
                        className="w-16 shrink-0 text-[13px]"
                        style={{ color: 'var(--color-text-tertiary)' }}
                      >
                        {row.unit}
                      </span>
                    </label>
                  ))}
                  <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                    Enter each label as the amount that went into the whole batch. You'll be logged{' '}
                    {eating === makes ? 'all of it' : `${eating}/${makes} of the total`}.
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void scan()}
            className="w-full rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98]"
            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', height: 52 }}
          >
            {shots.length === 1 ? 'Scan Label' : `Scan ${shots.length} Labels`}
          </button>
        </div>
      )}

      {stage === 'scanning' && (
        <div
          className="rounded-2xl border p-4 sm:p-5"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            {shots.length === 1 ? 'Reading label…' : `Reading ${shots.length} labels…`}
          </p>
          <div className="skeleton mt-3 h-11 w-full rounded-xl" />
          <div className="mt-4 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-4 flex-1 rounded" />
                <div className="skeleton h-11 w-32 shrink-0 rounded-xl" />
              </div>
            ))}
          </div>
        </div>
      )}

      {stage === 'result' && draft && (
        <div className="space-y-3">
          <MacroResultCard
            draft={draft}
            onChange={setDraft}
            serving={scannedServing}
            primaryLabel="Add to my day"
            onPrimary={add}
            warning={warning}
            showEdit
            breakdown={
              items.length > 1 ? (
                <div
                  className="mt-3 space-y-1.5 rounded-xl p-3"
                  style={{ background: 'var(--color-bg-surface)' }}
                >
                  {batch && (
                    <p
                      className="pb-1 text-[11px] font-semibold uppercase"
                      style={{ color: 'var(--color-text-tertiary)', letterSpacing: '0.04em' }}
                    >
                      Whole batch
                    </p>
                  )}
                  {items.map((it, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-3">
                      <span
                        className="min-w-0 flex-1 truncate text-[13px]"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {it.food_name}
                        {it.amount && (
                          <span style={{ color: 'var(--color-text-tertiary)' }}> · {it.amount}</span>
                        )}
                      </span>
                      <span
                        className="shrink-0 text-[13px] tabular-nums"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {round(it.calories).toLocaleString()} cal · {round(it.protein_g)}p ·{' '}
                        {round(it.carbs_g)}c · {round(it.fat_g)}f
                      </span>
                    </div>
                  ))}

                  {batch && (
                    <div
                      className="mt-1 space-y-1.5 border-t pt-2"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                          Batch total
                        </span>
                        <span
                          className="shrink-0 text-[13px] tabular-nums"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {round(batch.total.calories).toLocaleString()} cal ·{' '}
                          {round(batch.total.protein_g)}p · {round(batch.total.carbs_g)}c ·{' '}
                          {round(batch.total.fat_g)}f
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-3">
                        <span
                          className="text-[13px] font-semibold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          Your share
                        </span>
                        <span
                          className="shrink-0 text-[13px] font-semibold tabular-nums"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {batch.eating} of {batch.makes} servings
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : null
            }
          />
          <button
            type="button"
            onClick={() => reset()}
            className="mx-auto block text-[13px] underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Scan another
          </button>
        </div>
      )}

      {stage === 'error' && (
        <div
          className="rounded-2xl border p-5 text-center"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          <p className="text-[15px]" style={{ color: 'var(--color-text-primary)' }}>
            {errorText ?? "Couldn't read this label — try a clearer photo or better lighting"}
          </p>
          <button
            type="button"
            onClick={() => reset(true)}
            className="mt-4 rounded-full px-6 text-[15px] font-semibold"
            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', height: 48 }}
          >
            Try again
          </button>
        </div>
      )}

      {preparing && (
        <div
          className="above-dock fixed inset-x-0 bottom-6 z-40 mx-auto w-fit rounded-full px-4 py-2 text-[13px] shadow-pop"
          style={{ background: 'var(--color-bg-overlay)', color: 'var(--color-text-secondary)' }}
        >
          Preparing image…
        </div>
      )}
    </section>
  );
}
