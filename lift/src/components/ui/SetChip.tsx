import { SET_FLAGS } from '../../lib/types'
import type { SetFlag } from '../../lib/types'

export type ChipState = 'pending' | 'completed' | 'active'

const states: Record<ChipState, string> = {
  pending: 'bg-subtle border-[#1e1e1e] text-[#2a2a2a]',
  completed: 'bg-[rgba(200,160,80,0.1)] border-[rgba(200,160,80,0.3)] text-gold',
  active: 'bg-gold border-gold text-bg',
}

interface Props {
  label: string | number
  state: ChipState
  className?: string
}

export function SetChip({ label, state, className = '' }: Props) {
  return (
    <span
      className={`relative flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-set border font-mono text-[13px] font-medium transition-colors duration-300 ${states[state]} ${className}`}
    >
      {label}
    </span>
  )
}

// One pill style for every marker; only the colour changes.
const badges: Record<SetFlag, { text: string; cls: string }> = {
  warmup: { text: 'W', cls: 'text-ink-2 border-[#333]' },
  failure: { text: 'F', cls: 'text-[#ef4444] border-[#ef4444]' },
  drop: { text: 'DROP', cls: 'text-[#f59e0b] border-[#f59e0b]' },
}

export function KindBadge({ kind }: { kind: SetFlag }) {
  const b = badges[kind]
  return (
    <span
      className={`inline-flex h-[18px] shrink-0 items-center rounded-full border bg-transparent px-1.5 font-mono text-[9px] font-medium leading-none tracking-wider ${b.cls}`}
    >
      {b.text}
    </span>
  )
}

/** Every marker a set carries, inline, in a fixed W → F → DROP order. */
export function SetBadges({ flags }: { flags: Record<SetFlag, boolean> }) {
  const on = SET_FLAGS.filter((f) => flags[f])
  if (!on.length) return null
  return (
    <span className="flex items-center gap-1">
      {on.map((f) => (
        <KindBadge key={f} kind={f} />
      ))}
    </span>
  )
}
