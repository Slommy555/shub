import { useState } from 'react';
import { formatMoney, parseMoney } from '../../types/budget';

/**
 * A compact money input that shows the raw number while editing and formats it on
 * blur. Negative values are allowed through — clamp in the caller when the field
 * can't go below zero.
 */
export default function MoneyInput({
  value,
  onSave,
  placeholder = '$0',
  fullWidth = false,
  size = 'md',
  ariaLabel,
}: {
  value: number;
  onSave: (n: number) => void;
  placeholder?: string;
  fullWidth?: boolean;
  size?: 'md' | 'sm';
  ariaLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState('');
  const display = focused ? text : value ? formatMoney(value) : '';

  return (
    <input
      inputMode="decimal"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setText(value ? String(value) : '');
        requestAnimationFrame(() => e.target.select());
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = parseMoney(text);
        if (n !== value) onSave(n);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={`${fullWidth ? 'w-full' : size === 'sm' ? 'w-24' : 'w-32'} rounded-xl border px-3 text-right tabular-nums outline-none ${
        size === 'sm' ? 'text-sm' : 'text-base'
      }`}
      style={{
        height: size === 'sm' ? '38px' : '44px',
        background: 'var(--color-bg-surface)',
        borderColor: focused ? 'var(--color-accent-muted)' : 'var(--color-border)',
        color: 'var(--color-text-primary)',
      }}
    />
  );
}
