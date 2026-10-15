import { useMemo, useState } from 'react'
import { BookOpen, Plus, Search } from 'lucide-react'
import { PageHeader } from '../components/layout/Layout'
import { NAV_HEIGHT } from '../components/layout/Nav'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EmptyState } from '../components/ui/EmptyState'
import { Pill, Segmented } from '../components/ui/Pill'
import { Sheet } from '../components/ui/Sheet'
import { Skeleton } from '../components/ui/Skeleton'
import { VolumeChart } from '../components/ui/VolumeChart'
import { useLongPress } from '../components/ui/useLongPress'
import { useExercises } from '../hooks/useExercises'
import { exerciseRecords, exerciseSessions, useProgress } from '../hooks/useProgress'
import { fmtCompact, fmtWeight, shortDate } from '../lib/format'
import { EQUIPMENT, MUSCLE_GROUPS } from '../lib/types'
import type { Exercise } from '../lib/types'

function ExerciseRow({
  exercise,
  first,
  onOpen,
  onLongPress,
}: {
  exercise: Exercise
  first: boolean
  onOpen: () => void
  onLongPress: () => void
}) {
  const { handlers, didFire } = useLongPress(onLongPress)
  return (
    <button
      {...handlers}
      onClick={() => !didFire() && onOpen()}
      className={`flex w-full select-none items-center gap-2 bg-elevated px-4 py-3 text-left hover:bg-[#121212] ${first ? '' : 'border-t border-line'}`}
    >
      <span className="flex-1 text-[14px] text-ink">{exercise.name}</span>
      {!exercise.is_default && <span className="h-[5px] w-[5px] rotate-45 bg-gold" title="Custom" />}
      {exercise.muscle_group && <Pill>{exercise.muscle_group}</Pill>}
      {exercise.equipment && <Pill>{exercise.equipment}</Pill>}
    </button>
  )
}

function NewExerciseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { create } = useExercises()
  const [name, setName] = useState('')
  const [muscle, setMuscle] = useState<string>('chest')
  const [equipment, setEquipment] = useState<string>('barbell')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <Sheet open={open} onClose={onClose} eyebrow="Library" title="New Exercise">
      <div className="space-y-5">
        <div>
          <div className="label mb-2">Name</div>
          <input className="field" placeholder="e.g. Pendlay Row" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <div className="label mb-2">Muscle group</div>
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((m) => (
              <button
                key={m}
                onClick={() => setMuscle(m)}
                className={`h-8 rounded-full border px-3 text-[12px] capitalize ${
                  muscle === m ? 'border-gold-border bg-gold-dim text-gold' : 'border-line bg-subtle text-ink-2'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="label mb-2">Equipment</div>
          <Segmented options={EQUIPMENT.slice(0, 3).map((e) => ({ value: e as string, label: e }))} value={equipment} onChange={setEquipment} />
          <div className="mt-1.5">
            <Segmented options={EQUIPMENT.slice(3).map((e) => ({ value: e as string, label: e }))} value={equipment} onChange={setEquipment} />
          </div>
        </div>
        {error && <p className="text-[13px] text-danger">{error}</p>}
        <Button
          full
          size="lg"
          disabled={!name.trim() || saving}
          onClick={async () => {
            setSaving(true)
            setError(null)
            try {
              await create({ name: name.trim(), muscle_group: muscle, equipment })
              setName('')
              onClose()
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not save')
            } finally {
              setSaving(false)
            }
          }}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </Sheet>
  )
}

function ExerciseHistorySheet({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
  const { sets } = useProgress()
  const history = useMemo(() => (exercise ? exerciseSessions(sets, exercise.id) : []), [sets, exercise])
  const records = useMemo(() => (exercise ? exerciseRecords(sets, exercise.id) : null), [sets, exercise])
  const last5 = history.slice(-5)

  return (
    <Sheet open={!!exercise} onClose={onClose} eyebrow={exercise ? `${exercise.muscle_group ?? ''} · ${exercise.equipment ?? ''}` : ''} title={exercise?.name}>
      {!history.length ? (
        <p className="py-6 text-center font-mono text-[12px] text-ink-2">No sessions logged yet</p>
      ) : (
        <>
          <Card className="px-2 pb-2 pt-3">
            <VolumeChart data={last5} compact />
          </Card>
          {records && (
            <div className="mt-3 grid grid-cols-3 gap-2 font-mono">
              <div className="rounded-input border border-line bg-subtle px-3 py-2">
                <div className="label text-[9px]">Best</div>
                <div className="text-[15px] text-gold">
                  {records.bestWeight ? `${fmtWeight(records.bestWeight.weight)}×${records.bestWeight.reps}` : '—'}
                </div>
              </div>
              <div className="rounded-input border border-line bg-subtle px-3 py-2">
                <div className="label text-[9px]">Volume</div>
                <div className="text-[15px] text-gold">{fmtCompact(records.bestVolume)}</div>
              </div>
              <div className="rounded-input border border-line bg-subtle px-3 py-2">
                <div className="label text-[9px]">Reps</div>
                <div className="text-[15px] text-gold">{records.bestReps?.reps ?? '—'}</div>
              </div>
            </div>
          )}
          <div className="mt-4 space-y-1">
            {[...last5].reverse().map((h) => (
              <div key={h.sessionId} className="flex items-center justify-between border-b border-line-muted py-2 font-mono text-[13px] last:border-0">
                <span className="text-ink-2">{shortDate(h.date)}</span>
                <span className="text-ink">
                  {h.sets} sets · {fmtWeight(h.topWeight)} × {h.topReps}
                  {h.isPR && <span className="ml-2 text-[10px] text-gold">PR</span>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

export default function Library() {
  const { exercises, loading, remove } = useExercises()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState<Exercise | null>(null)
  const [deleting, setDeleting] = useState<Exercise | null>(null)
  const [error, setError] = useState<string | null>(null)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = exercises
      .filter((e) => !needle || e.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name))
    return MUSCLE_GROUPS.map((g) => ({ group: g, items: list.filter((e) => (e.muscle_group ?? 'other') === g) })).filter(
      (g) => g.items.length,
    )
  }, [exercises, q])

  return (
    <div>
      <PageHeader title="Library" right={<span className="font-mono text-[12px] text-ink-2">{exercises.length} exercises</span>} />
      <div className="px-5">
        <div className="relative mb-5">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-2" />
          <input className="field pl-10" placeholder="Search exercises" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {loading ? (
          <Skeleton className="h-80" />
        ) : groups.length ? (
          <div className="space-y-6">
            {groups.map(({ group, items }) => (
              <section key={group}>
                <div className="label mb-2">{group}</div>
                <div className="overflow-hidden rounded-card border border-line">
                  {items.map((ex, i) => (
                    <ExerciseRow
                      key={ex.id}
                      exercise={ex}
                      first={i === 0}
                      onOpen={() => setViewing(ex)}
                      onLongPress={() => !ex.is_default && setDeleting(ex)}
                    />
                  ))}
                </div>
              </section>
            ))}
            <p className="pb-4 text-center text-[11px] text-ink-2">Long-press a custom exercise to delete it</p>
          </div>
        ) : (
          <EmptyState icon={BookOpen} title="No matches" body="Try a different search, or add it as a new exercise." />
        )}
      </div>

      <button
        aria-label="New exercise"
        onClick={() => setCreating(true)}
        className="fixed z-20 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-bg shadow-[0_8px_30px_rgba(200,160,80,0.25)] transition-[filter] hover:brightness-110"
        style={{ bottom: `calc(env(safe-area-inset-bottom) + ${NAV_HEIGHT + 20}px)`, right: "max(20px, calc(50% - 236px))" }}
      >
        <Plus size={24} strokeWidth={2.2} />
      </button>

      <NewExerciseSheet open={creating} onClose={() => setCreating(false)} />
      <ExerciseHistorySheet exercise={viewing} onClose={() => setViewing(null)} />

      <Sheet
        open={!!deleting}
        onClose={() => {
          setDeleting(null)
          setError(null)
        }}
        eyebrow="Delete"
        title={deleting ? `Delete ${deleting.name}?` : ''}
      >
        <p className="mb-5 text-[14px] text-ink-2">Its logged sets and template entries are removed too.</p>
        {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            full
            onClick={async () => {
              if (!deleting) return
              try {
                await remove(deleting.id)
                setDeleting(null)
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not delete')
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
