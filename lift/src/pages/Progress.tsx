import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, ChevronDown, Search } from 'lucide-react'
import { PageHeader } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { GoldDivider } from '../components/ui/GoldDivider'
import { Skeleton } from '../components/ui/Skeleton'
import { VolumeChart } from '../components/ui/VolumeChart'
import { exerciseRecords, exerciseSessions, useProgress } from '../hooks/useProgress'
import { useExercises } from '../hooks/useExercises'
import { useProgram } from '../hooks/useProgram'
import { fmtCompact, fmtNum, fmtWeight, shortDate } from '../lib/format'
import type { Exercise } from '../lib/types'

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 px-3 py-3">
      <div className="label text-[10px]">{label}</div>
      <div className="mt-1 font-mono text-[20px] leading-tight text-ink">{value}</div>
    </div>
  )
}

function ExerciseSelect({
  options,
  value,
  onChange,
}: {
  options: Exercise[]
  value: Exercise | null
  onChange: (e: Exercise) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDoc)
    return () => document.removeEventListener('pointerdown', onDoc)
  }, [open])

  const filtered = options.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-input border border-line bg-subtle px-4 py-3 text-left"
      >
        <span className="font-display text-[17px] font-bold text-ink">{value?.name ?? 'Choose exercise'}</span>
        <ChevronDown size={17} className={`text-ink-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-input border border-line bg-elevated shadow-2xl">
          <div className="relative border-b border-line">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search"
              className="w-full bg-transparent py-3 pl-10 pr-3 text-[14px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  onChange(o)
                  setOpen(false)
                  setQ('')
                }}
                className={`block w-full px-4 py-2.5 text-left text-[14px] hover:bg-subtle ${o.id === value?.id ? 'text-gold' : 'text-ink'}`}
              >
                {o.name}
              </button>
            ))}
            {!filtered.length && <div className="px-4 py-3 text-[13px] text-ink-2">No matches</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Progress() {
  const { sets, sessionCount, totalVolume, recentExerciseIds, loading } = useProgress()
  const { byId } = useExercises()
  const { position } = useProgram()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const logged = useMemo(
    () => recentExerciseIds.map((id) => byId.get(id)).filter((e): e is Exercise => !!e),
    [recentExerciseIds, byId],
  )
  const exerciseId = selectedId ?? logged[0]?.id ?? null
  const exercise = exerciseId ? byId.get(exerciseId) ?? null : null

  const history = useMemo(() => (exerciseId ? exerciseSessions(sets, exerciseId) : []), [sets, exerciseId])
  const records = useMemo(() => (exerciseId ? exerciseRecords(sets, exerciseId) : null), [sets, exerciseId])
  const last8 = history.slice(-8)

  return (
    <div>
      <PageHeader title="Progress" />

      <div className="px-5">
        <Card className="flex divide-x divide-line">
          <Stat label="Sessions" value={loading ? '—' : fmtNum(sessionCount)} />
          <Stat label="Volume" value={loading ? '—' : fmtCompact(totalVolume)} />
          <Stat label="Program wk" value={position?.status === 'active' ? String(position.week) : '—'} />
        </Card>

        <GoldDivider className="my-6" />

        {loading ? (
          <Skeleton className="h-64" />
        ) : !logged.length ? (
          <EmptyState icon={BarChart3} title="Nothing logged yet" body="Finish a workout and your progress shows up here." />
        ) : (
          <>
            <ExerciseSelect options={logged} value={exercise} onChange={(e) => setSelectedId(e.id)} />

            <Card className="mt-4 px-3 pb-3 pt-4">
              <div className="mb-2 flex items-center justify-between px-2">
                <div className="label">Volume · last {last8.length}</div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-ink-2">
                  <span className="h-2 w-2 rounded-sm" style={{ background: '#e8c27a' }} /> PR
                </div>
              </div>
              <VolumeChart data={last8} />
            </Card>

            {records && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'Best weight',
                    value: records.bestWeight ? fmtWeight(records.bestWeight.weight) : '—',
                    sub: records.bestWeight ? `× ${records.bestWeight.reps}` : '',
                  },
                  { label: 'Best volume', value: fmtCompact(records.bestVolume), sub: 'lb / session' },
                  {
                    label: 'Best reps',
                    value: records.bestReps ? String(records.bestReps.reps) : '—',
                    sub: records.bestReps ? `@ ${fmtWeight(records.bestReps.weight)}` : '',
                  },
                ].map((r) => (
                  <Card key={r.label} className="px-3 py-3">
                    <div className="label text-[10px]">{r.label}</div>
                    <div className="mt-1 font-mono text-[20px] leading-tight text-gold">{r.value}</div>
                    <div className="font-mono text-[11px] text-ink-2">{r.sub}</div>
                  </Card>
                ))}
              </div>
            )}

            <div className="label mb-2 mt-6">History</div>
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[1fr_56px_1fr] border-b border-line px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-2">
                <span>Date</span>
                <span className="text-center">Sets</span>
                <span className="text-right">Top set</span>
              </div>
              {[...history].reverse().map((h) => (
                <div
                  key={h.sessionId}
                  className="grid grid-cols-[1fr_56px_1fr] items-center border-b border-line-muted px-4 py-3 font-mono text-[13px] last:border-0"
                >
                  <span className="text-ink-2">{shortDate(h.date)}</span>
                  <span className="text-center text-ink">{h.sets}</span>
                  <span className="flex items-center justify-end gap-2 text-ink">
                    {h.isPR && (
                      <span className="rounded-full border border-gold-border bg-gold-dim px-1.5 py-px text-[9px] tracking-wider text-gold">
                        PR
                      </span>
                    )}
                    {fmtWeight(h.topWeight)} × {h.topReps}
                  </span>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
