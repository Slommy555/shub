import { useEffect, useRef, useState } from 'react';
import { formatOz, loadPresets, MAX_PRESETS, savePresets } from '../../lib/water';

const LONG_PRESS_MS = 500;

interface Props {
  userId: string;
  disabled?: boolean;
  /** Logs the amount. The caller decides what else a log does (haptics, sync). */
  onLog: (oz: number) => void;
  /** `sm` is the one-line Home row; `md` is the full card on Focus. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * The quick-add pills, editable in place: tap to log, hold (or right-click) to
 * change what a button adds, "+" to add another, and clearing an amount to
 * empty removes that button.
 *
 * Shared by the Home water row and the Focus card so the two show the same
 * buttons — they read and write one list in localStorage, per user. Presets are
 * a per-device UI preference; nothing about them belongs in Supabase.
 */
export default function QuickAddRow({
  userId,
  disabled = false,
  onLog,
  size = 'md',
  className = '',
}: Props) {
  const [presets, setPresets] = useState<number[]>(() => loadPresets(userId));
  // Which pill is in edit mode: an index, 'new' for the one being added, or none.
  const [editing, setEditing] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState('');

  const height = size === 'sm' ? 30 : 40;
  const textSize = size === 'sm' ? 'text-[12px]' : 'text-[13px]';
  const padX = size === 'sm' ? 'px-2.5' : 'px-4';
  const fieldWidth = size === 'sm' ? 58 : 72;

  function persist(next: number[]) {
    setPresets(next);
    savePresets(userId, next);
  }

  function commit() {
    const oz = Number(draft);
    const valid = draft.trim() !== '' && Number.isFinite(oz) && oz > 0;
    if (editing === 'new') {
      if (valid) persist([...presets, oz].slice(0, MAX_PRESETS));
    } else if (typeof editing === 'number') {
      if (valid) {
        persist(presets.map((p, i) => (i === editing ? oz : p)));
      } else if (presets.length > 1) {
        // Blanking the field deletes the button — but never the last one, or
        // there'd be nothing left to hold down to get it back.
        persist(presets.filter((_, i) => i !== editing));
      }
    }
    setEditing(null);
    setDraft('');
  }

  function cancel() {
    setEditing(null);
    setDraft('');
  }

  const field = (label: string, placeholder: string) => (
    <input
      type="number"
      inputMode="decimal"
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') cancel();
      }}
      placeholder={placeholder}
      aria-label={label}
      className={`rounded-full border text-center ${textSize} font-semibold tabular-nums outline-none`}
      style={{
        height,
        width: fieldWidth,
        background: 'var(--color-bg-surface)',
        borderColor: 'var(--color-accent-muted)',
        color: 'var(--color-text-primary)',
      }}
    />
  );

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {presets.map((oz, i) =>
        editing === i ? (
          <span key={i}>{field(`Quick-add amount ${i + 1} in ounces — empty removes it`, 'oz')}</span>
        ) : (
          <QuickAddPill
            key={i}
            oz={oz}
            disabled={disabled}
            height={height}
            textSize={textSize}
            padX={padX}
            onAdd={() => onLog(oz)}
            onCustomize={() => {
              setDraft(String(oz));
              setEditing(i);
            }}
          />
        )
      )}

      {editing === 'new'
        ? field('New quick-add amount in ounces', 'oz')
        : presets.length < MAX_PRESETS && (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                setEditing('new');
              }}
              title="Add another quick-add amount"
              aria-label="Add another quick-add amount"
              className={`rounded-full border ${padX} ${textSize} font-medium active:opacity-85`}
              style={{
                height,
                background: 'transparent',
                borderColor: 'var(--color-border-strong)',
                color: 'var(--color-text-secondary)',
              }}
            >
              +
            </button>
          )}
    </div>
  );
}

/**
 * A quick-add pill. Tap logs the amount; a long press (or right-click on
 * desktop) switches it into the inline editor instead of logging.
 */
function QuickAddPill({
  oz,
  disabled,
  height,
  textSize,
  padX,
  onAdd,
  onCustomize,
}: {
  oz: number;
  disabled: boolean;
  height: number;
  textSize: string;
  padX: string;
  onAdd: () => void;
  onCustomize: () => void;
}) {
  const timer = useRef<number | null>(null);
  const longPressed = useRef(false);

  function start() {
    if (disabled) return;
    longPressed.current = false;
    timer.current = window.setTimeout(() => {
      longPressed.current = true;
      onCustomize();
    }, LONG_PRESS_MS);
  }

  function cancel() {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }

  useEffect(() => cancel, []);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(e) => {
        e.preventDefault();
        cancel();
        onCustomize();
      }}
      onClick={() => {
        // The long press already opened the editor — don't also log a drink.
        if (longPressed.current) return;
        onAdd();
      }}
      title={`Add ${formatOz(oz)}oz — hold to change or remove this button`}
      className={`rounded-full ${padX} ${textSize} font-semibold tabular-nums select-none active:scale-[0.98] active:opacity-85 disabled:opacity-40`}
      style={{
        height,
        background: 'var(--color-accent-subtle)',
        color: 'var(--color-accent)',
        touchAction: 'manipulation',
      }}
    >
      +{formatOz(oz)}oz
    </button>
  );
}
