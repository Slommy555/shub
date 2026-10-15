import { useEffect, useState } from 'react'
import { ArrowRight, Minus, Plus, Repeat, TrendingUp, Trophy } from 'lucide-react'
import { Sheet } from '../ui/Sheet'
import { Button } from '../ui/Button'
import { GoldDivider } from '../ui/GoldDivider'
import { computeTemplateChanges, useWorkoutSession } from '../../hooks/useWorkoutSession'
import type { FinishSummary, TemplateChange } from '../../hooks/useWorkoutSession'
import { saveSessionToTemplate, useTemplates } from '../../hooks/useTemplates'
import { useProgram } from '../../hooks/useProgram'
import { fmtDuration, fmtNum, fmtWeight } from '../../lib/format'
import type { ProgramDay } from '../../lib/types'

type Step = 'changes' | 'new-template' | 'saving' | 'summary'

const changeIcon: Record<TemplateChange['kind'], typeof Plus> = {
  added: Plus,
  removed: Minus,
  sets: TrendingUp,
  reps: TrendingUp,
  weight: TrendingUp,
  reorder: Repeat,
}

interface Props {
  open: boolean
  onCancel: () => void
  onDone: () => void
  onStartNext: (day: ProgramDay) => void
}

export function FinishModal({ open, onCancel, onDone, onStartNext }: Props) {
  const { live, finish } = useWorkoutSession()
  const { create: createTemplate, byId: templatesById } = useTemplates()
  const { pendingToday } = useProgram()
  const [step, setStep] = useState<Step>('changes')
  const [changes, setChanges] = useState<TemplateChange[]>([])
  const [newName, setNewName] = useState('')
  const [summary, setSummary] = useState<FinishSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Decide the first step each time the sheet opens.
  useEffect(() => {
    if (!open || !live || summary) return
    setError(null)
    const c = computeTemplateChanges(live)
    setChanges(c)
    if (live.templateId && c.length) setStep('changes')
    else if (!live.templateId && live.exercises.length) {
      setNewName(live.name === 'Workout' ? '' : live.name)
      setStep('new-template')
    } else void complete(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function complete(saveTemplate: boolean, asNew = false) {
    if (!live) return
    setStep('saving')
    setError(null)
    try {
      if (saveTemplate) {
        let templateId = live.templateId
        if (asNew) templateId = (await createTemplate(newName.trim() || 'Workout')).id
        if (templateId) await saveSessionToTemplate(templateId, live.exercises)
      }
      setSummary(await finish())
      setStep('summary')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setStep(live.templateId ? 'changes' : 'new-template')
    }
  }

  function close() {
    const done = !!summary
    setSummary(null)
    setStep('changes')
    if (done) onDone()
    else onCancel()
  }

  // Only chain into the next scheduled workout after a program workout.
  const next = summary?.programDayId ? pendingToday.find((d) => d.id !== summary.programDayId) : undefined
  const nextTemplate = next?.template_id ? templatesById.get(next.template_id) : undefined

  return (
    <Sheet
      open={open}
      onClose={close}
      locked={step === 'saving' || step === 'summary'}
      eyebrow={step === 'summary' ? 'Session complete' : 'Finish workout'}
      title={
        step === 'changes'
          ? 'Save changes to template?'
          : step === 'new-template'
            ? 'Save as a template?'
            : step === 'summary'
              ? summary?.name
              : 'Saving…'
      }
    >
      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      {step === 'changes' && (
        <>
          <ul className="mb-5 space-y-2">
            {changes.map((c, i) => {
              const Icon = changeIcon[c.kind]
              return (
                <li key={i} className="flex items-center gap-3 rounded-input border border-line bg-subtle px-3 py-2.5 text-[14px] text-ink">
                  <Icon size={14} className="shrink-0 text-gold" />
                  <span className="font-mono text-[13px]">{c.text}</span>
                </li>
              )
            })}
          </ul>
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => complete(false)}>
              Don't Save
            </Button>
            <Button full onClick={() => complete(true)}>
              Save to Template
            </Button>
          </div>
        </>
      )}

      {step === 'new-template' && (
        <>
          <p className="mb-3 text-[13px] text-ink-2">Keep this exercise list to start from next time.</p>
          <input className="field mb-5" placeholder="Template name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <div className="flex gap-3">
            <Button variant="ghost" full onClick={() => complete(false)}>
              Skip
            </Button>
            <Button full disabled={!newName.trim()} onClick={() => complete(true, true)}>
              Save Template
            </Button>
          </div>
        </>
      )}

      {step === 'saving' && <div className="skeleton h-24 rounded-card" />}

      {step === 'summary' && summary && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Volume', value: fmtNum(summary.volume), unit: 'lb' },
              { label: 'Duration', value: fmtDuration(summary.durationSeconds), unit: '' },
              { label: 'Exercises', value: String(summary.exercisesCompleted), unit: `${summary.setsCompleted} sets` },
            ].map((s) => (
              <div key={s.label} className="rounded-input border border-line bg-subtle px-3 py-3">
                <div className="label text-[10px]">{s.label}</div>
                <div className="mt-1 font-mono text-[20px] leading-tight text-ink">{s.value}</div>
                {s.unit && <div className="font-mono text-[11px] text-ink-2">{s.unit}</div>}
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="label mb-2">PRs hit</div>
            {summary.prs.length ? (
              <ul className="space-y-2">
                {summary.prs.map((pr) => (
                  <li key={pr.exerciseName} className="flex items-center gap-3 rounded-input border border-gold-border bg-gold-dim px-3 py-2.5">
                    <Trophy size={15} className="text-gold" />
                    <span className="flex-1 text-[14px] text-ink">{pr.exerciseName}</span>
                    <span className="font-mono text-[14px] text-gold">
                      {fmtWeight(pr.weight)} × {pr.reps}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="font-mono text-[12px] text-ink-2">None this session</p>
            )}
          </div>

          <Button full size="lg" className="mt-6" onClick={close}>
            Done
          </Button>

          {next && (
            <>
              <GoldDivider className="my-6" />
              <div className="eyebrow mb-1">Next up</div>
              <div className="mb-4 font-display text-[20px] font-bold text-ink">
                {next.label || nextTemplate?.name || 'Workout'}
              </div>
              <div className="flex gap-3">
                <Button variant="ghost" full onClick={close}>
                  Skip
                </Button>
                <Button
                  variant="outline"
                  full
                  onClick={() => {
                    setSummary(null)
                    setStep('changes')
                    onStartNext(next)
                  }}
                >
                  Start Now <ArrowRight size={15} />
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
