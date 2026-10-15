import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Moon } from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Pill } from '../ui/Pill'
import { useProgram } from '../../hooks/useProgram'
import { estimateMinutes, useTemplates } from '../../hooks/useTemplates'
import { useWorkoutSession } from '../../hooks/useWorkoutSession'
import type { ProgramDay } from '../../lib/types'

/** Today's scheduled workout for the active program, with a Start button. */
export function TodayCard() {
  const navigate = useNavigate()
  const { active, position, todayWorkouts, pendingToday } = useProgram()
  const { byId } = useTemplates()
  const w = useWorkoutSession()

  if (!active || !position) return null

  async function start(day: ProgramDay) {
    const t = day.template_id ? byId.get(day.template_id) : undefined
    if (!t || !active) return
    await w.start({
      templateId: t.id,
      programDayId: day.id,
      programId: active.id,
      name: t.name,
      deload: position?.status === 'active' && position.isDeload,
    })
    navigate('/log')
  }

  if (position.status === 'upcoming' || position.status === 'unscheduled' || position.status === 'complete') {
    return (
      <Card className="px-5 py-5">
        <div className="eyebrow mb-1">{active.name}</div>
        <div className="font-display text-[20px] font-bold text-ink">
          {position.status === 'upcoming'
            ? `Starts in ${position.startsIn} day${position.startsIn === 1 ? '' : 's'}`
            : position.status === 'complete'
              ? 'Program complete'
              : 'No start date set'}
        </div>
      </Card>
    )
  }

  if (!todayWorkouts.length) {
    return (
      <Card className="px-5 py-6">
        <div className="eyebrow mb-1 text-ink-2">
          Day {position.dayNumber} · Week {position.week}
        </div>
        <div className="flex items-center gap-3">
          <Moon size={20} strokeWidth={1.5} className="text-ink-2" />
          <div className="font-display text-[24px] font-bold text-ink">Rest Day</div>
        </div>
        <p className="mt-2 text-[13px] text-ink-2">Recovery is where the work turns into strength.</p>
      </Card>
    )
  }

  const day = pendingToday[0]
  if (!day) {
    return (
      <Card className="px-5 py-6">
        <div className="eyebrow mb-1">
          Day {position.dayNumber} · Week {position.week}
        </div>
        <div className="flex items-center gap-3">
          <CheckCircle2 size={20} strokeWidth={1.5} className="text-gold" />
          <div className="font-display text-[22px] font-bold text-ink">Done for today</div>
        </div>
      </Card>
    )
  }

  const t = day.template_id ? byId.get(day.template_id) : undefined
  const label = day.label || t?.day_label || t?.name || 'Workout'

  return (
    <Card accent className="px-5 pb-5 pt-5">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow truncate">
          Day {position.dayNumber} · {label}
        </div>
        {position.isDeload && <Pill gold>Deload 60%</Pill>}
      </div>
      <div className="mt-2 font-display text-[30px] font-extrabold leading-[1.05] tracking-tight text-ink">
        {t?.name ?? 'Workout'}
      </div>
      <div className="mt-2 font-mono text-[12px] text-ink-2">
        {t ? `${t.exercises.length} exercises · ~${estimateMinutes(t)} min` : '—'}
        {pendingToday.length > 1 && ` · +${pendingToday.length - 1} more today`}
      </div>
      <Button full size="lg" className="mt-5" disabled={!t || w.starting} onClick={() => start(day)}>
        {w.starting ? 'Starting…' : 'Start Workout'}
      </Button>
    </Card>
  )
}
