export function GoldDivider({ className = '' }: { className?: string }) {
  return <div className={`h-px w-full ${className}`} style={{ background: 'var(--gold-divider)' }} />
}
