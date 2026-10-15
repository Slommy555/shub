import type { ReactNode } from 'react'

export function Pill({ children, gold, className = '' }: { children: ReactNode; gold?: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full border px-2.5 font-sans text-[11px] capitalize ${
        gold ? 'border-gold-border bg-gold-dim text-gold' : 'border-line bg-subtle text-ink-2'
      } ${className}`}
    >
      {children}
    </span>
  )
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-btn border border-line bg-subtle p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-9 flex-1 rounded-[9px] text-[13px] font-medium capitalize transition-colors ${
            o.value === value ? 'bg-gold-dim text-gold ring-1 ring-gold-border' : 'text-ink-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
