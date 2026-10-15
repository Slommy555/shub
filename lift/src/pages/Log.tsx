import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarOff, Dumbbell, MoreHorizontal, Plus, X } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { GoldDivider } from '../components/ui/GoldDivider'
import { ActionList, Sheet } from '../components/ui/Sheet'
import { EmptyState } from '../components/ui/EmptyState'
import { Skeleton } from '../components/ui/Skeleton'
import { ExerciseCard } from '../components/workout/ExerciseCard'
import { SupersetGroup } from '../components/workout/SupersetGroup'
import { RestTimer } from '../components/workout/RestTimer'
import { FinishModal } from '../components/workout/FinishModal'
import { ExercisePicker } from '../components/workout/ExercisePicker'
import { TodayCard } from '../components/workout/TodayCard'
import { isExerciseComplete, useNow, useTotals, useWorkoutSession } from '../hooks/useWorkoutSession'
import { useProgram } from '../hooks/useProgram'
import { estimateMinutes, useTemplates } from '../hooks/useTemplates'
import type { TemplateWithExercises } from '../hooks/useTemplates'
import { fmtClock } from '../lib/format'
import type { LiveExercise, ProgramDay } from '../lib/types'

const FADE_MS = 400
const SLIDE_MS = 300

interface Unit {
  key: string
  exercises: LiveExercise[]
  complete: boolean
  completedAt: number
}

/** Group exercises sharing a superset id into one unit, placed at the first member. */
function toUnits(exercises: LiveExercise[]): Unit[] {
  const units: Unit[] = []
  const byGroup = new Map<string, Unit>()
  for (const ex of exercises) {
    const g = ex.supersetGroupId
    if (g && byGroup.has(g)) {
      byGroup.get(g)!.exercises.push(ex)
      continue
    }
    const unit: Unit = { key: g ?? ex.key, exercises: [ex], complete: false, completedAt: 0 }
    if (g) byGroup.set(g, unit)
    units.push(unit)
  }
  for (const u of units) {
    u.complete = u.exercises.every(isExerciseComplete)
    u.completedAt = Math.max(...u.exercises.map((e) => e.completedAt ?? 0))
  }
  return units
}

/** FLIP: when `order` changes, slide each keyed element from its old offsetTop. */
function useFlip(order: string) {
  const nodes = useRef(new Map<string, HTMLElement>())
  const tops = useRef(new Map<string, number>())

  useLayoutEffect(() => {
    const next = new Map<string, number>()
    nodes.current.forEach((el, key) => {
      const top = el.offsetTop
      next.set(key, top)
      const prev = tops.current.get(key)
      if (prev == null || prev === top) return
      el.style.transition = 'none'
      el.style.transform = `translateY(${prev - top}px)`
      requestAnimationFrame(() => {
        el.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${FADE_MS}ms ease`
        el.style.transform = ''
      })
    })
    tops.current = next
  }, [order])

  return (key: string) => (el: HTMLElement | null) => {
    if (el) nodes.current.set(key, el)
    else nodes.current.delete(key)
  }
}

function ActiveSession({ onFinish }: { onFinish: () => void }) {
  const w = useWorkoutSession()
  const live = w.live!
  const now = useNow(1000)
  const totals = useTotals(live)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [picking, setPicking] = useState(false)
  const [sunk, setSunk] = useState<Set<string>>(new Set())

  const units = useMemo(() => toUnits(live.exercises), [live.exercises])

  // Completed units fade first, then sink once the fade has played.
  useEffect(() => {
    const timers: number[] = []
    const completeKeys = new Set(units.filter((u) => u.complete).map((u) => u.key))
    setSunk((prev) => {
      const kept = new Set([...prev].filter((k) => completeKeys.has(k)))
      return kept.size === prev.size ? prev : kept
    })
    for (const k of completeKeys) {
      if (sunk.has(k)) continue
      timers.push(window.setTimeout(() => setSunk((prev) => new Set(prev).add(k)), FADE_MS))
    }
    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units])

  const ordered = useMemo(() => {
    const top = units.filter((u) => !sunk.has(u.key))
    const bottom = units.filter((u) => sunk.has(u.key)).sort((a, b) => a.completedAt - b.completedAt)
    return [...top, ...bottom]
  }, [units, sunk])

  const activeKey = ordered.find((u) => !u.complete)?.key
  const register = useFlip(ordered.map((u) => u.key).join('|'))
  const firstKey = live.exercises[0]?.key ?? ''
  const lastKey = live.exercises[live.exercises.length - 1]?.key ?? ''

  return (
    <>
      <header className="sticky top-0 z-20 bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-[22px] font-bold leading-tight text-ink">{live.name}</h1>
            <div className="font-mono text-[11px] text-ink-2">
              {totals.done}/{totals.total} sets
            </div>
          </div>
          <div className="font-mono text-[18px] tabular-nums text-gold">{fmtClock((now - live.startedAt) / 1000)}</div>
          <button
            aria-label="Abandon workout"
            onClick={() => setConfirmAbandon(true)}
            className="-mr-1 flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:bg-subtle hover:text-ink"
          >
            <X size={19} />
          </button>
        </div>
        <GoldDivider />
      </header>

      <div className="space-y-3 px-4 pb-24 pt-4">
        {ordered.map((u) => (
          <div
            key={u.key}
            ref={register(u.key)}
            style={{ opacity: u.complete ? 0.3 : 1, transition: `opacity ${FADE_MS}ms ease` }}
          >
            {u.exercises.length > 1 ? (
              <SupersetGroup exercises={u.exercises} active={u.key === activeKey} firstKey={firstKey} lastKey={lastKey} />
            ) : (
              <ExerciseCard
                exercise={u.exercises[0]}
                active={u.key === activeKey}
                isFirst={u.exercises[0].key === firstKey}
                isLast={u.exercises[0].key === lastKey}
              />
            )}
          </div>
        ))}

        {!live.exercises.length && (
          <EmptyState icon={Dumbbell} title="Empty workout" body="Add exercises as you go. You can save it as a template when you finish." />
        )}

        <Button variant="outline" full onClick={() => setPicking(true)}>
          <Plus size={16} /> Add Exercise
        </Button>
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(ex) => {
          setPicking(false)
          void w.addExercise(ex)
        }}
      />

      <Sheet open={confirmAbandon} onClose={() => setConfirmAbandon(false)} eyebrow="Abandon" title="Discard this workout?">
        <p className="mb-5 text-[14px] text-ink-2">Nothing from this session will be saved.</p>
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setConfirmAbandon(false)}>
            Keep Going
          </Button>
          <Button
            variant="danger"
            full
            onClick={async () => {
              setConfirmAbandon(false)
              await w.abandon()
            }}
          >
            Discard
          </Button>
        </div>
      </Sheet>

      <RestTimer onFinish={onFinish} />
    </>
  )
}

/** Finish flow wired to the program, so "Start Now" can launch the next workout. */
function FinishModalHost({ open, onClose }: { open: boolean; onClose: () => void }) {
  const w = useWorkoutSession()
  const { active, position } = useProgram()
  const { byId } = useTemplates()

  async function startNext(day: ProgramDay) {
    const t = day.template_id ? byId.get(day.template_id) : undefined
    onClose()
    if (!t) return
    await w.start({
      templateId: t.id,
      programDayId: day.id,
      programId: active?.id ?? null,
      name: t.name,
      deload: position?.status === 'active' && position.isDeload,
    })
  }

  return <FinishModal open={open} onCancel={onClose} onDone={onClose} onStartNext={startNext} />
}

function TemplateList({ templates }: { templates: TemplateWithExercises[] }) {
  const w = useWorkoutSession()
  const { remove } = useTemplates()
  const [menu, setMenu] = useState<TemplateWithExercises | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <>
      <div className="overflow-hidden rounded-card border border-line">
        {templates.map((t, i) => (
          <div key={t.id} className={`flex items-center bg-elevated ${i ? 'border-t border-line' : ''}`}>
            <button
              disabled={w.starting}
              onClick={() => w.start({ templateId: t.id, name: t.name })}
              className="flex flex-1 flex-col items-start px-4 py-3.5 text-left"
            >
              <span className="font-display text-[16px] font-semibold text-ink">{t.name}</span>
              <span className="font-mono text-[11px] text-ink-2">
                {t.exercises.length} exercises · ~{estimateMinutes(t)} min
              </span>
            </button>
            <button aria-label="Template options" onClick={() => setMenu(t)} className="px-4 py-4 text-ink-2 hover:text-ink">
              <MoreHorizontal size={17} />
            </button>
          </div>
        ))}
      </div>

      <Sheet
        open={!!menu}
        onClose={() => {
          setMenu(null)
          setConfirmDelete(false)
        }}
        eyebrow="Template"
        title={menu?.name}
      >
        {confirmDelete ? (
          <>
            <p className="mb-5 text-[14px] text-ink-2">Program days using this template will be unassigned. Logged sessions are kept.</p>
            <div className="flex gap-3">
              <Button variant="ghost" full onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                full
                onClick={async () => {
                  if (menu) await remove(menu.id)
                  setMenu(null)
                  setConfirmDelete(false)
                }}
              >
                Delete
              </Button>
            </div>
          </>
        ) : (
          <ActionList
            items={[
              {
                label: 'Start workout',
                onSelect: () => {
                  if (menu) void w.start({ templateId: menu.id, name: menu.name })
                  setMenu(null)
                },
              },
              { label: 'Delete template', tone: 'danger', onSelect: () => setConfirmDelete(true) },
            ]}
          />
        )}
      </Sheet>
    </>
  )
}

function DefaultState() {
  const w = useWorkoutSession()
  const { active, loading } = useProgram()
  const { templates, loading: tLoading } = useTemplates()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <div className="px-5">
      <header className="flex items-end justify-between pb-6 pt-6">
        <h1 className="font-display text-[30px] font-extrabold leading-none tracking-[0.04em] text-gold">LIFT</h1>
        <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-ink-2">{today}</div>
      </header>

      {loading ? (
        <Skeleton className="h-[210px]" />
      ) : active ? (
        <TodayCard />
      ) : (
        <Card className="py-2">
          <EmptyState
            icon={CalendarOff}
            title="No program active"
            body="Build a program to get today's workout here."
            action={
              <Link to="/program" className="text-[13px] font-medium uppercase tracking-[0.14em] text-gold">
                Go to Program
              </Link>
            }
          />
        </Card>
      )}

      <GoldDivider className="my-7" />

      <div className="mb-3 flex items-center justify-between">
        <div className="label">Templates</div>
        <button
          disabled={w.starting}
          onClick={() => w.start({ templateId: null, name: 'Workout' })}
          className="flex items-center gap-1 text-[12px] font-medium uppercase tracking-[0.12em] text-gold"
        >
          <Plus size={13} /> Empty workout
        </button>
      </div>
      {tLoading ? (
        <Skeleton className="h-32" />
      ) : templates.length ? (
        <TemplateList templates={templates} />
      ) : (
        <p className="text-[13px] leading-relaxed text-ink-2">
          No templates yet. Start an empty workout and save it as a template when you finish.
        </p>
      )}
    </div>
  )
}

export default function Log() {
  const { live } = useWorkoutSession()
  // Mounted at the page root so the summary survives the session clearing.
  const [finishing, setFinishing] = useState(false)

  return (
    <>
      {live ? <ActiveSession onFinish={() => setFinishing(true)} /> : <DefaultState />}
      <FinishModalHost open={finishing} onClose={() => setFinishing(false)} />
    </>
  )
}
