/** Text tabs with a gold underline on the active one (DM Mono caps). */
export function SubTabs<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={`flex gap-6 border-b border-line ${className}`}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`relative -mb-px pb-2.5 font-mono text-[12px] uppercase tracking-[0.18em] transition-colors ${
              active ? 'text-gold' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {o.label}
            <span
              className={`absolute inset-x-0 bottom-0 h-[2px] bg-gold transition-opacity ${active ? 'opacity-100' : 'opacity-0'}`}
            />
          </button>
        )
      })}
    </div>
  )
}
