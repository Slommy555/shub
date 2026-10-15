import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Minus, Moon, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Sheet } from '../components/ui/Sheet'
import { Pill, Segmented } from '../components/ui/Pill'
import { EmptyState } from '../components/ui/EmptyState'
import { GoldDivider } from '../components/ui/GoldDivider'
import { Skeleton } from '../components/ui/Skeleton'
import { TodayCard } from '../components/workout/TodayCard'
import { programPosition, useProgram } from '../hooks/useProgram'
import { useTemplates } from '../hooks/useTemplates'
import type { TemplateWithExercises } from '../hooks/useTemplates'
import { addDays, isoDate, nextMonday, parseDate, shortDate } from '../lib/format'
import type { Program as ProgramT, ProgramDay } from '../lib/types'

function NewProgramSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useProgram()
  const [name, setName] = useState('')
  const [start, setStart] = useState(() => isoDate(nextMonday()))
  const [weeks, setWeeks] = useState(12)
  const [cycle, setCycle] = useState<7 | 8>(7)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setSaving(true)
    setError(null)
    try {
      await create({ name: name.trim(), start_date: start, total_weeks: weeks, cycle_length: cycle })
      setName('')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create program')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Program" title="New Program">
      <div className="space-y-5">
        <div>
          <div className="label mb-2">Name</div>
          <input className="field" placeholder="7-Day Size & Strength" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="label mb-2">Start date</div>
          <input type="date" className="field font-mono" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <div className="label mb-2">Total weeks</div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Fewer weeks"
              onClick={() => setWeeks((w) => Math.max(1, w - 1))}
              className="flex h-11 w-11 items-center justify-center rounded-btn border border-line bg-subtle text-ink"
            >
              <Minus size={16} />
            </button>
            <div className="flex-1 text-center font-mono text-[22px] text-ink">{weeks}</div>
            <button
              aria-label="More weeks"
              onClick={() => setWeeks((w) => Math.min(52, w + 1))}
              className="flex h-11 w-11 items-center justify-center rounded-btn border border-line bg-subtle text-ink"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        <div>
          <div className="label mb-2">Cycle length</div>
          <Segmented
            options={[
              { value: 7 as const, label: '7 days' },
              { value: 8 as const, label: '8 days' },
            ]}
            value={cycle}
            onChange={setCycle}
          />
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <Button full size="lg" disabled={!name.trim() || saving} onClick={submit}>
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </Sheet>
  )
}

function TemplatePicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (t: TemplateWithExercises) => void
}) {
  const { templates, create } = useTemplates()
  const [name, setName] = useState('')

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Assign" title="Choose a template">
      {templates.length > 0 && (
        <div className="mb-5 overflow-hidden rounded-card border border-line">
          {templates.map((t, i) => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className={`flex w-full flex-col items-start bg-subtle px-4 py-3 text-left hover:bg-[#181818] ${i ? 'border-t border-line' : ''}`}
            >
              <span className="font-display text-[15px] font-semibold text-ink">{t.name}</span>
              <span className="font-mono text-[11px] text-ink-2">{t.exercises.length} exercises</span>
            </button>
          ))}
        </div>
      )}
      <div className="label mb-2">New template</div>
      <div className="flex gap-2">
        <input className="field" placeholder="e.g. Push A" value={name} onChange={(e) => setName(e.target.value)} />
        <Button
          disabled={!name.trim()}
          onClick={async () => {
            const t = await create(name.trim())
            setName('')
            onPick({ ...t, exercises: [] })
          }}
        >
          Add
        </Button>
      </div>
      <p className="mt-2 text-[12px] text-ink-2">
        New templates start empty. Add exercises during the workout and save them to the template when you finish.
      </p>
    </Sheet>
  )
}

function DaySheet({
  program,
  dayNumber,
  onClose,
}: {
  program: ProgramT
  dayNumber: number | null
  onClose: () => void
}) {
  const { daysFor, addDay, removeDay, setRest, updateDay } = useProgram()
  const { byId } = useTemplates()
  const [picking, setPicking] = useState(false)
  const entries = dayNumber ? daysFor(program.id, dayNumber) : []
  const isRest = entries.some((d) => d.is_rest)
  const workouts = entries.filter((d) => !d.is_rest)

  return (
    <>
      <Sheet open={dayNumber != null && !picking} onClose={onClose} eyebrow={`Day ${dayNumber ?? ''} · every week`} title={isRest ? 'Rest Day' : workouts.length ? 'Workouts' : 'Unassigned'}>
        <div className="space-y-2">
          {workouts.map((d) => {
            const t = d.template_id ? byId.get(d.template_id) : undefined
            return (
              <div key={d.id} className="flex items-center gap-2 rounded-input border border-line bg-subtle px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[15px] font-semibold text-ink">{t?.name ?? 'Template removed'}</div>
                  <input
                    defaultValue={d.label ?? ''}
                    placeholder="Label (e.g. Full Body · Together)"
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null
                      if (v !== d.label) void updateDay(d.id, { label: v })
                    }}
                    className="w-full bg-transparent font-mono text-[11px] uppercase tracking-wider text-gold outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-ink-3"
                  />
                </div>
                <button aria-label="Remove workout" onClick={() => removeDay(d.id)} className="p-2 text-ink-2 hover:text-danger">
                  <Trash2 size={15} />
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" full onClick={() => setPicking(true)}>
            <Plus size={15} /> {workouts.length ? 'Add another' : 'Assign workout'}
          </Button>
          {!isRest && (
            <Button variant="ghost" full onClick={() => dayNumber && setRest(program.id, dayNumber)}>
              <Moon size={15} /> Rest day
            </Button>
          )}
        </div>
      </Sheet>

      <TemplatePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={async (t) => {
          setPicking(false)
          if (dayNumber) await addDay(program.id, dayNumber, t.id, t.day_label)
        }}
      />
    </>
  )
}

function shortLabel(day: ProgramDay, t: TemplateWithExercises | undefined): string {
  const raw = day.label || t?.name || ''
  // "Monday · Full Body · Together" → "Full Body"
  const parts = raw.split('·').map((p) => p.trim()).filter(Boolean)
  return (parts.length > 1 ? parts[1] : parts[0]) ?? ''
}

function ProgramDetail({ program, onBack }: { program: ProgramT; onBack: () => void }) {
  const { daysFor, setActive, deactivate, remove, toggleDeload } = useProgram()
  const { byId } = useTemplates()
  const [dayNumber, setDayNumber] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const pos = programPosition(program)
  const start = program.start_date ? parseDate(program.start_date) : null
  const weeks = Array.from({ length: program.total_weeks }, (_, i) => i + 1)
  const cycleDays = Array.from({ length: program.cycle_length }, (_, i) => i + 1)

  return (
    <div className="px-5 pt-5">
      <button onClick={onBack} className="mb-4 flex items-center gap-1.5 text-[13px] text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> Programs
      </button>
      <div className="eyebrow mb-1">{program.is_active ? 'Active program' : 'Program'}</div>
      <h1 className="font-display text-[28px] font-extrabold leading-tight text-ink">{program.name}</h1>
      <div className="mt-1 font-mono text-[12px] text-ink-2">
        {program.cycle_length}-day cycle · {program.total_weeks} weeks
        {start && ` · starts ${shortDate(start)}`}
      </div>

      <div className="mt-4 flex gap-2">
        {program.is_active ? (
          <Button variant="ghost" size="sm" onClick={() => deactivate(program.id)}>
            Deactivate
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setActive(program.id)}>
            Set active
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>

      <GoldDivider className="my-6" />

      <div className="label mb-3">Schedule · tap a day to assign</div>
      <div className="space-y-2">
        {weeks.map((week) => {
          const deload = program.deload_weeks?.includes(week)
          return (
            <div key={week} className={deload ? 'opacity-80' : ''}>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[11px] text-ink-2">
                  W{week}
                  {start && <span className="text-ink-3"> · {shortDate(addDays(start, (week - 1) * program.cycle_length))}</span>}
                </span>
                <button
                  onClick={() => toggleDeload(program, week)}
                  className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${
                    deload ? 'border-gold-border bg-gold-dim text-gold' : 'border-line text-ink-3 hover:text-ink-2'
                  }`}
                >
                  Deload{deload ? ' 60%' : ''}
                </button>
              </div>
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${program.cycle_length}, minmax(0, 1fr))` }}>
                {cycleDays.map((d) => {
                  const entries = daysFor(program.id, d)
                  const rest = entries.some((e) => e.is_rest)
                  const work = entries.filter((e) => !e.is_rest)
                  const first = work[0]
                  const isToday = pos.status === 'active' && pos.week === week && pos.dayNumber === d
                  const date = start ? addDays(start, (week - 1) * program.cycle_length + d - 1) : null
                  return (
                    <button
                      key={d}
                      onClick={() => setDayNumber(d)}
                      className={`flex h-[54px] flex-col items-center justify-center rounded-set border px-0.5 text-center transition-colors ${
                        isToday ? 'border-gold bg-gold-dim' : 'border-line bg-elevated hover:border-[#262626]'
                      }`}
                    >
                      <span className={`font-mono text-[9px] ${isToday ? 'text-gold' : 'text-ink-3'}`}>
                        {date ? date.getDate() : d}
                      </span>
                      {rest ? (
                        <span className="text-[9px] uppercase tracking-wider text-ink-3">Rest</span>
                      ) : first ? (
                        <span className="line-clamp-2 text-[9px] font-medium leading-tight text-ink">
                          {shortLabel(first, first.template_id ? byId.get(first.template_id) : undefined)}
                          {work.length > 1 && <span className="text-gold"> +{work.length - 1}</span>}
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-3">+</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <DaySheet program={program} dayNumber={dayNumber} onClose={() => setDayNumber(null)} />

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} eyebrow="Delete" title={`Delete ${program.name}?`}>
        <p className="mb-5 text-[14px] text-ink-2">The schedule is removed. Templates and logged sessions are kept.</p>
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            full
            onClick={async () => {
              await remove(program.id)
              setConfirmDelete(false)
              onBack()
            }}
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

export default function Program() {
  const { programs, active, loading } = useProgram()
  const [creating, setCreating] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = useMemo(() => programs.find((p) => p.id === selectedId) ?? null, [programs, selectedId])

  if (selected) return <ProgramDetail program={selected} onBack={() => setSelectedId(null)} />

  return (
    <div>
      <PageHeader
        title="Program"
        right={
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus size={14} /> New Program
          </Button>
        }
      />
      <div className="space-y-3 px-5">
        {active && <TodayCard />}
        {active && <GoldDivider className="my-6" />}

        {loading ? (
          <Skeleton className="h-24" />
        ) : programs.length ? (
          programs.map((p) => {
            const pos = programPosition(p)
            return (
              <Card key={p.id} accent={p.is_active} className="cursor-pointer px-5 py-4" onClick={() => setSelectedId(p.id)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-display text-[18px] font-bold text-ink">{p.name}</div>
                  {p.is_active && <Pill gold>Active</Pill>}
                </div>
                <div className="mt-1 font-mono text-[12px] text-ink-2">
                  {p.cycle_length}-day cycle · {p.total_weeks} wk
                  {p.start_date && ` · ${shortDate(parseDate(p.start_date))}`}
                  {pos.status === 'active' && ` · W${pos.week}`}
                </div>
              </Card>
            )
          })
        ) : (
          <EmptyState
            icon={CalendarDays}
            title="No programs yet"
            body="A program schedules your templates across the week."
            action={<Button onClick={() => setCreating(true)}>New Program</Button>}
          />
        )}
      </div>
      <NewProgramSheet open={creating} onClose={() => setCreating(false)} />
    </div>
  )
}
