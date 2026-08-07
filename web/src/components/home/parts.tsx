/** Shared building blocks for the Home tab's cards (UI_SKILL.md tokens). */

/** A Home section card: elevated background, 16px radius, 16px padding. */
export function Card({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  /** When set the whole card becomes a button (e.g. Budget → Budget tab). */
  onClick?: () => void;
  className?: string;
}) {
  const style: React.CSSProperties = {
    background: 'var(--color-bg-elevated)',
    borderColor: 'var(--color-border)',
    borderRadius: 16,
    padding: 16,
  };
  // h-full + flex column: cards stretch to fill their grid cell, and anything
  // marked `mt-auto` inside them (footers, the Start button) pins to the bottom.
  const base = 'flex h-full flex-col border';
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} w-full items-stretch text-left transition-colors active:opacity-90 ${className}`}
        style={style}
      >
        {children}
      </button>
    );
  }
  return (
    <section className={`${base} ${className}`} style={style}>
      {children}
    </section>
  );
}

/** ALL CAPS section header, with an optional right-aligned count/meta. */
export function SectionHeader({ title, meta }: { title: string; meta?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2
        className="text-[13px] font-medium uppercase"
        style={{ letterSpacing: '0.08em', color: 'var(--color-text-secondary)' }}
      >
        {title}
      </h2>
      {meta != null && (
        <span className="shrink-0 text-[13px]" style={{ color: 'var(--color-text-tertiary)' }}>
          {meta}
        </span>
      )}
    </div>
  );
}

/** A card-shaped skeleton, matching the real card's box so nothing jumps. */
export function CardSkeleton({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <Card className={className}>
      <div className="skeleton mb-3 h-3 w-24 rounded" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skeleton h-8 rounded-lg" />
        ))}
      </div>
    </Card>
  );
}

/**
 * The completion toggle: a 22px circle that fills with the accent when checked,
 * inside a 44px tap target.
 */
export function CheckCircle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="-my-2 grid h-11 w-11 shrink-0 place-items-center"
    >
      <span
        className="grid h-[22px] w-[22px] place-items-center rounded-full border-2"
        style={{
          background: checked ? 'var(--color-accent)' : 'transparent',
          borderColor: checked ? 'var(--color-accent)' : 'var(--color-border-strong)',
          transition: 'background-color 150ms ease, border-color 150ms ease',
        }}
      >
        {checked && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent-text)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        )}
      </span>
    </button>
  );
}
