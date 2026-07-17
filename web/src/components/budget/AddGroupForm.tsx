import { useState } from 'react';
import { PRESET_COLORS } from '../../types/budget';

/**
 * Collapsed → a single "Add expense group" button. Expanded → an inline form
 * with a name field and a row of preset color swatches (no full color wheel).
 */
export default function AddGroupForm({ onAdd }: { onAdd: (name: string, color: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(PRESET_COLORS[5]); // lavender default

  const submit = () => {
    const n = name.trim();
    if (!n) return;
    onAdd(n, color);
    setName('');
    setColor(PRESET_COLORS[5]);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 w-full rounded-full py-3.5 text-sm font-semibold transition-opacity active:opacity-85"
        style={{ background: 'var(--color-accent)', color: '#16161f', minHeight: '48px' }}
      >
        + Add expense group
      </button>
    );
  }

  return (
    <div
      className="mt-4 rounded-2xl border p-4"
      style={{ background: 'var(--color-bg-elevated)', borderColor: 'var(--color-border)' }}
    >
      <input
        autoFocus
        placeholder="Group name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        className="mb-3 w-full rounded-xl border px-4 text-base outline-none"
        style={{
          height: '48px',
          background: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      />
      <div className="mb-4 flex flex-wrap gap-2.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Choose color ${c}`}
            aria-pressed={color === c}
            className="h-9 w-9 rounded-full transition-transform active:scale-95"
            style={{
              background: c,
              outline: color === c ? '2px solid var(--color-text-primary)' : 'none',
              outlineOffset: '2px',
            }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          className="flex-1 rounded-full py-3 text-sm font-semibold active:opacity-85"
          style={{ background: 'var(--color-accent)', color: '#16161f', minHeight: '48px' }}
        >
          Add
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName('');
          }}
          className="rounded-full border px-5 text-sm font-semibold"
          style={{
            borderColor: 'var(--color-border-strong)',
            color: 'var(--color-text-primary)',
            background: 'var(--color-bg-surface)',
            minHeight: '48px',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
