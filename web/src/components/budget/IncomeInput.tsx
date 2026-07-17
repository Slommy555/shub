import { useEffect, useRef, useState } from 'react';
import { formatMoney, parseMoney } from '../../types/budget';

/**
 * Large currency input for the period's income. Shows the raw number while
 * editing (easy to retype), formats on blur, and saves on blur or Enter with a
 * brief "Saved" confirmation.
 */
export default function IncomeInput({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (n: number) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const commit = () => {
    setFocused(false);
    const n = parseMoney(text);
    if (n !== value) {
      onSave(n);
      setSaved(true);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 1500);
    }
  };

  const display = focused ? text : value ? formatMoney(value) : '';

  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor="budget-income" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </label>
        {saved && (
          <span className="text-xs" style={{ color: 'var(--color-success)' }}>
            Saved
          </span>
        )}
      </div>
      <input
        id="budget-income"
        inputMode="decimal"
        placeholder="$0.00"
        value={display}
        onFocus={(e) => {
          setFocused(true);
          setText(value ? String(value) : '');
          requestAnimationFrame(() => e.target.select());
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-xl border px-4 text-2xl font-bold tabular-nums outline-none"
        style={{
          height: '56px',
          background: 'var(--color-bg-surface)',
          borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
    </div>
  );
}
