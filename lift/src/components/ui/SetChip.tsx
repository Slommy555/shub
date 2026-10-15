import type { SetKind } from '../../lib/types'

export type ChipState = 'pending' | 'completed' | 'active'

const states: Record<ChipState, string> = {
  pending: 'bg-subtle border-[#1e1e1e] text-[#2a2a2a]',
  completed: 'bg-[rgba(200,160,80,0.1)] border-[rgba(200,160,80,0.3)] text-gold',
  active: 'bg-gold border-gold text-bg',
}

interface Props {
  label: string | number
  state: ChipState
  kind?: SetKind
  className?: string
}

export function SetChip({ label, state, kind = 'normal', className = '' }: Props) {
  return (
    <span
      className={`relative flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-set border font-mono text-[13px] font-medium transition-colors duration-300 ${states[state]} ${className}`}
    >
      {kind === 'warmup' ? 'W' : label}
    </span>
  )
}

const badges = {
  warmup: { text: 'W', cls: 'text-ink-2 border-[#262626] bg-subtle' },
  failure: { text: 'F', cls: 'text-danger border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.08)]' },
  drop: { text: 'DROP', cls: 'text-warning border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)]' },
} as const

export function KindBadge({ kind }: { kind: SetKind }) {
  if (kind === 'normal') return null
  const b = badges[kind]
  return (
    <span className={`inline-flex h-[18px] items-center rounded-full border px-1.5 font-mono text-[9px] font-medium tracking-wider ${b.cls}`}>
      {b.text}
    </span>
  )
}
