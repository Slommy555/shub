import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Pill } from '../ui/Pill'
import { useExercises } from '../../hooks/useExercises'
import { MUSCLE_GROUPS } from '../../lib/types'
import type { Exercise } from '../../lib/types'

interface Props {
  open: boolean
  onClose: () => void
  onPick: (exercise: Exercise) => void
  title?: string
  /** Show muscle-group filter chips above the list. */
  filterable?: boolean
}

export function ExercisePicker({ open, onClose, onPick, title = 'Add exercise', filterable }: Props) {
  const { exercises } = useExercises()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<string | null>(null)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = exercises.filter((e) => !needle || e.name.toLowerCase().includes(needle))
    return MUSCLE_GROUPS.filter((g) => !muscle || g === muscle)
      .map((g) => ({ group: g, items: list.filter((e) => (e.muscle_group ?? 'other') === g) }))
      .filter((g) => g.items.length)
  }, [exercises, q, muscle])

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2" />
        <input className="field pl-10" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filterable && (
        <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5">
          {[null, ...MUSCLE_GROUPS].map((m) => (
            <button
              key={m ?? 'all'}
              onClick={() => setMuscle(m)}
              className={`h-8 shrink-0 rounded-full border px-3 text-[12px] capitalize ${
                muscle === m ? 'border-gold-border bg-gold-dim text-gold' : 'border-line bg-subtle text-ink-2'
              }`}
            >
              {m ?? 'All'}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-5">
        {groups.map(({ group, items }) => (
          <div key={group}>
            <div className="label mb-2">{group}</div>
            <div className="overflow-hidden rounded-card border border-line">
              {items.map((ex, i) => (
                <button
                  key={ex.id}
                  onClick={() => {
                    onPick(ex)
                    setQ('')
                  }}
                  className={`flex w-full items-center justify-between bg-subtle px-4 py-3 text-left text-[14px] text-ink hover:bg-[#181818] ${i ? 'border-t border-line' : ''}`}
                >
                  {ex.name}
                  {ex.equipment && <Pill>{ex.equipment}</Pill>}
                </button>
              ))}
            </div>
          </div>
        ))}
        {!groups.length && <p className="py-6 text-center text-[13px] text-ink-2">No matches</p>}
      </div>
    </Sheet>
  )
}
