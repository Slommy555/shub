import { useEffect, useRef, useState } from 'react';
import MacroResultCard, { type MacroDraft } from './MacroResultCard';
import { prepareImage, scanLabel, type PreparedImage } from '../../lib/nutritionScan';
import type { Macros } from '../../types/nutrition';

type Stage = 'idle' | 'selected' | 'scanning' | 'result' | 'error';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const CameraIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" {...stroke}>
    <path d="M14.5 4h-5L8 6.5H5a2 2 0 0 0-2 2V18a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5a2 2 0 0 0-2-2h-3z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

const UploadIcon = (
  <svg width="28" height="28" viewBox="0 0 24 24" {...stroke}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M12 16V3M7.5 7.5 12 3l4.5 4.5" />
  </svg>
);

/**
 * The scan flow: pick a photo → describe how much you ate → Claude reads the
 * label and does the serving-size math → edit anything that looks off → add it
 * to the day. The photo is never uploaded anywhere but the one Claude call.
 */
export default function LabelScanner({
  onAdd,
}: {
  onAdd: (entry: Macros & { food_name: string; serving_size: string | null }) => void;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [amount, setAmount] = useState('');
  const [draft, setDraft] = useState<MacroDraft | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  /** The serving text at scan time — the input keeps living behind the card. */
  const [scannedAmount, setScannedAmount] = useState('');

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // One place owns the preview's object URL: React runs this cleanup with the
  // previous image whenever it changes, and once more on unmount.
  useEffect(
    () => () => {
      if (image) URL.revokeObjectURL(image.previewUrl);
    },
    [image]
  );

  function reset(keepAmount = false) {
    setImage(null);
    setDraft(null);
    setWarning(null);
    setErrorText(null);
    if (!keepAmount) setAmount('');
    setStage('idle');
  }

  async function pick(file: File | undefined) {
    if (!file) return;
    setErrorText(null);
    try {
      const prepared = await prepareImage(file, () => setPreparing(true));
      setImage(prepared);
      setStage('selected');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Could not read that image.');
      setStage('error');
    } finally {
      setPreparing(false);
    }
  }

  async function scan() {
    if (!image) return;
    const serving = amount.trim();
    setScannedAmount(serving);
    setStage('scanning');
    try {
      const res = await scanLabel(image, serving);
      setDraft({
        food_name: res.food_name,
        calories: res.calories,
        protein_g: res.protein_g,
        carbs_g: res.carbs_g,
        fat_g: res.fat_g,
      });
      setWarning(
        res.note ?? (res.confidence === 'low' ? 'Low confidence — double-check these numbers.' : null)
      );
      setStage('result');
    } catch {
      setErrorText("Couldn't read this label — try a clearer photo or better lighting");
      setStage('error');
    }
  }

  function add() {
    if (!draft) return;
    onAdd({ ...draft, serving_size: scannedAmount || null });
    reset();
  }

  const amountInput = (
    <input
      value={amount}
      onChange={(e) => setAmount(e.target.value)}
      placeholder="e.g. 1 cup, 100g, 2 slices, half the bag"
      aria-label="Amount eaten"
      className="w-full rounded-xl border px-4 text-[15px] outline-none"
      style={{
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-text-primary)',
        height: 48,
      }}
    />
  );

  return (
    <section className="mt-4">
      {/* Both inputs stay mounted so the hidden file pickers keep their refs. */}
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
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {stage === 'idle' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              { icon: CameraIcon, label: 'Take Photo', ref: cameraRef },
              { icon: UploadIcon, label: 'Upload Image', ref: uploadRef },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => opt.ref.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border transition-transform active:scale-[0.98]"
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  height: 140,
                }}
              >
                {opt.icon}
                <span className="text-[15px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  {opt.label}
                </span>
              </button>
            ))}
          </div>
          {amountInput}
        </div>
      )}

      {stage === 'selected' && image && (
        <div className="space-y-3">
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
          >
            <img
              src={image.previewUrl}
              alt="Selected nutrition label"
              className="mx-auto block max-h-[250px] w-full object-contain sm:max-h-[300px]"
            />
            <button
              type="button"
              onClick={() => reset(true)}
              aria-label="Remove image"
              className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full"
              style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          {amountInput}
          <button
            type="button"
            onClick={() => void scan()}
            className="w-full rounded-full text-[15px] font-semibold transition-transform active:scale-[0.98]"
            style={{ background: 'var(--color-accent)', color: 'var(--color-accent-text)', height: 52 }}
          >
            Scan Label
          </button>
        </div>
      )}

      {stage === 'scanning' && (
        <div
          className="rounded-2xl border p-4 sm:p-5"
          style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
        >
          <p className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
            Reading label…
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
            serving={scannedAmount || null}
            primaryLabel="Add to my day"
            onPrimary={add}
            warning={warning}
            showEdit
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
