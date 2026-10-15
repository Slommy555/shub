import { Fragment } from 'react'
import { ExerciseCard } from './ExerciseCard'
import type { LiveExercise } from '../../lib/types'

interface Props {
  exercises: LiveExercise[]
  active: boolean
  firstKey: string
  lastKey: string
}

export function SupersetGroup({ exercises, active, firstKey, lastKey }: Props) {
  return (
    <div
      className={`relative rounded-card border border-gold-border bg-elevated pt-3 ${active ? 'gold-strip' : ''}`}
    >
      <div className="px-4 font-mono text-[10px] uppercase tracking-[0.2em] text-gold">Superset</div>
      {exercises.map((ex, i) => (
        <Fragment key={ex.key}>
          {i > 0 && <div className="mx-4 h-px bg-gold-border opacity-60" />}
          <ExerciseCard
            exercise={ex}
            active={active}
            letter={String.fromCharCode(65 + i)}
            isFirst={ex.key === firstKey}
            isLast={ex.key === lastKey}
          />
        </Fragment>
      ))}
    </div>
  )
}
