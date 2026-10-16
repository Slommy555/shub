import { useState } from 'react'
import { Check, MoreHorizontal, Plus } from 'lucide-react'
import { SetRow } from './SetRow'
import { ActionList, Sheet } from '../ui/Sheet'
import { KindBadge } from '../ui/SetChip'
import { Segmented } from '../ui/Pill'
import { isExerciseComplete, useWorkoutSession } from '../../hooks/useWorkoutSession'
import type { LiveExercise, SetFlag } from '../../lib/types'

const REST_OPTIONS = [60, 90, 120, 180].map((s) => ({ value: s, label: s < 120 ? `${s}s` : `${s / 60}m` }))

interface Props {
  exercise: LiveExercise
  active: boolean
  /** Superset position letter; renders without its own card chrome when set. */
  letter?: string
  isFirst: boolean
  isLast: boolean
}

export function ExerciseCard({ exercise, active, letter, isFirst, isLast }: Props) {
  const w = useWorkoutSession()
  const [setMenu, setSetMenu] = useState<string | null>(null)
  const [exMenu, setExMenu] = useState(false)
  const complete = isExerciseComplete(exercise)
  const firstOpen = exercise.sets.find((s) => !s.done)?.id

  // Warmups and working sets count separately; the W badge tells them apart.
  let working = 0
  let warm = 0
  const numbers = exercise.sets.map((s) => (s.warmup ? ++warm : ++working))
  const menuSet = exercise.sets.find((s) => s.id === setMenu)

  const kindItem = (kind: SetFlag, label: string) => ({
    label: menuSet?.[kind] ? `Unmark ${label.replace('Mark as ', '')}` : label,
    badge: <KindBadge kind={kind} />,
    active: !!menuSet?.[kind],
    onSelect: () => {
      if (setMenu) w.toggleFlag(exercise.key, setMenu, kind)
      setSetMenu(null)
    },
  })

  const body = (
    <>
      <div className="flex items-start gap-3">
        {letter && (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gold-border font-mono text-[11px] text-gold">
            {letter}
          </span>
        )}
        <h3 className="flex-1 font-display text-[18px] font-bold leading-snug text-ink">{exercise.name}</h3>
        {complete && <Check size={16} className="mt-1 text-gold" />}
        <button
          aria-label="Exercise options"
          onClick={() => setExMenu(true)}
          className="-mr-1 flex h-7 w-7 items-center justify-center text-ink-2 hover:text-ink"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="mt-3 space-y-1">
        {exercise.sets.map((s, i) => (
          <SetRow
            key={s.id}
            set={s}
            number={numbers[i]}
            chip={s.done ? 'completed' : active && s.id === firstOpen ? 'active' : 'pending'}
            onChange={(patch) => w.updateSet(exercise.key, s.id, patch)}
            onToggle={() => w.toggleSet(exercise.key, s.id)}
            onMenu={() => setSetMenu(s.id)}
          />
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          onClick={() => w.addSet(exercise.key)}
          className="flex items-center gap-1 py-1.5 text-[12px] font-medium uppercase tracking-[0.12em] text-gold"
        >
          <Plus size={13} strokeWidth={2.2} /> Add Set
        </button>
        <span className="font-mono text-[11px] text-ink-2">REST {exercise.restSeconds}s</span>
      </div>
      {exercise.lastSummary && (
        <div className="mt-1 font-mono text-[11px] text-ink-3">Last session: {exercise.lastSummary}</div>
      )}

      <Sheet open={!!menuSet} onClose={() => setSetMenu(null)} eyebrow={exercise.name} title="Set options">
        <ActionList
          items={[
            kindItem('warmup', 'Mark as Warmup'),
            kindItem('failure', 'Mark as Failure'),
            kindItem('drop', 'Mark as Drop Set'),
            {
              label: 'Remove Set',
              tone: 'danger',
              onSelect: () => {
                if (setMenu) w.removeSet(exercise.key, setMenu)
                setSetMenu(null)
              },
            },
          ]}
        />
      </Sheet>

      <Sheet open={exMenu} onClose={() => setExMenu(false)} eyebrow="Exercise" title={exercise.name}>
        <div className="label mb-2">Rest between sets</div>
        <Segmented options={REST_OPTIONS} value={exercise.restSeconds} onChange={(v) => w.setRest(exercise.key, v)} />
        <div className="mt-5">
          <ActionList
            items={[
              ...(!isFirst ? [{ label: 'Move up', onSelect: () => { w.moveExercise(exercise.key, -1); setExMenu(false) } }] : []),
              ...(!isLast ? [{ label: 'Move down', onSelect: () => { w.moveExercise(exercise.key, 1); setExMenu(false) } }] : []),
              ...(!isLast
                ? [{ label: 'Superset with next', onSelect: () => { w.supersetWithNext(exercise.key); setExMenu(false) } }]
                : []),
              ...(exercise.supersetGroupId
                ? [{ label: 'Break superset', tone: 'muted' as const, onSelect: () => { w.unlinkSuperset(exercise.key); setExMenu(false) } }]
                : []),
              { label: 'Remove exercise', tone: 'danger' as const, onSelect: () => { w.removeExercise(exercise.key); setExMenu(false) } },
            ]}
          />
        </div>
      </Sheet>
    </>
  )

  if (letter) return <div className="px-4 py-4">{body}</div>
  return (
    <div
      className={`rounded-card border bg-elevated px-4 py-4 ${active ? 'gold-strip border-[#222]' : 'border-line'}`}
    >
      {body}
    </div>
  )
}
