import { useEffect, useState } from 'react'
import { Check, MoreHorizontal } from 'lucide-react'
import { KindBadge, SetChip } from '../ui/SetChip'
import type { ChipState } from '../ui/SetChip'
import { useLongPress } from '../ui/useLongPress'
import { fmtWeight, numOrNull } from '../../lib/format'
import type { LiveSet } from '../../lib/types'

/** Tap-to-edit number: looks like text, edits like an input. */
function NumField({
  value,
  onCommit,
  muted,
  label,
  integer,
}: {
  value: number | null
  onCommit: (v: number | null) => void
  muted?: boolean
  label: string
  integer?: boolean
}) {
  const [draft, setDraft] = useState<string>(value == null ? '' : fmtWeight(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setDraft(value == null ? '' : fmtWeight(value))
  }, [value, focused])

  return (
    <input
      aria-label={label}
      inputMode={integer ? 'numeric' : 'decimal'}
      enterKeyHint="done"
      value={draft}
      placeholder="—"
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onChange={(e) => setDraft(e.target.value.replace(integer ? /[^\d]/g : /[^\d.]/g, ''))}
      onBlur={() => {
        setFocused(false)
        const n = numOrNull(draft)
        onCommit(n == null ? null : integer ? Math.round(n) : n)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      className={`h-9 w-[58px] rounded-set border border-transparent bg-transparent text-center font-mono text-[16px] outline-none transition-colors placeholder:text-ink-3 focus:border-gold-border focus:bg-subtle ${
        muted ? 'text-ink-2' : 'text-ink'
      }`}
    />
  )
}

function Tick({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={done ? 'Mark set not done' : 'Mark set done'}
      onClick={onClick}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-set border transition-colors duration-200 ${
        done ? 'border-gold bg-gold text-bg' : 'border-[#262626] bg-subtle text-transparent hover:border-gold-border'
      }`}
    >
      <Check size={17} strokeWidth={2.5} />
    </button>
  )
}

interface Props {
  set: LiveSet
  number: number
  chip: ChipState
  onChange: (patch: Partial<LiveSet>) => void
  onToggle: () => void
  onMenu: () => void
}

export function SetRow({ set, number, chip, onChange, onToggle, onMenu }: Props) {
  const { handlers } = useLongPress(onMenu)
  const muted = set.done
  const isDrop = set.kind === 'drop'

  return (
    <div className="flex items-center gap-2 py-1">
      <div {...handlers} className="relative flex flex-col items-center">
        <SetChip label={number} state={chip} kind={set.kind} />
        {set.kind !== 'normal' && set.kind !== 'warmup' && (
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2">
            <KindBadge kind={set.kind} />
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center">
          {isDrop && <span className="w-9 text-[10px] uppercase tracking-wider text-ink-2">Start</span>}
          <NumField label="Weight" value={set.weight} muted={muted} onCommit={(v) => onChange({ weight: v })} />
          <span className="px-1 font-mono text-[13px] text-ink-3">×</span>
          <NumField label="Reps" integer value={set.reps} muted={muted} onCommit={(v) => onChange({ reps: v })} />
        </div>
        {isDrop && (
          <div className="flex items-center">
            <span className="w-9 text-[10px] uppercase tracking-wider text-warning">Drop</span>
            <NumField label="Drop weight" value={set.dropWeight} muted={muted} onCommit={(v) => onChange({ dropWeight: v })} />
            <span className="px-1 font-mono text-[13px] text-ink-3">×</span>
            <NumField label="Drop reps" integer value={set.dropReps} muted={muted} onCommit={(v) => onChange({ dropReps: v })} />
          </div>
        )}
      </div>

      <Tick done={set.done} onClick={onToggle} />
      <button
        type="button"
        aria-label="Set options"
        onClick={onMenu}
        className="flex h-9 w-7 items-center justify-center text-ink-2 hover:text-ink"
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  )
}
