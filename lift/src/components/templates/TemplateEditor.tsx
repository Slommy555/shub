import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, GripVertical, Layers, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { Segmented } from '../ui/Pill'
import { ActionList, Sheet } from '../ui/Sheet'
import { moveItem, useDragReorder } from '../ui/useDragReorder'
import { ExercisePicker } from '../workout/ExercisePicker'
import { useExercises } from '../../hooks/useExercises'
import { saveTemplate, useTemplates } from '../../hooks/useTemplates'
import { fmtWeight, numOrNull, uid } from '../../lib/format'

const REST_OPTIONS = [60, 90, 120, 180].map((s) => ({ value: s, label: s < 120 ? `${s}s` : `${s / 60}m` }))

interface DraftExercise {
  key: string
  exercise_id: string
  name: string
  default_sets: number
  default_reps: number
  default_weight: number | null
  rest_seconds: number
  notes: string | null
  superset_group_id: string | null
}

/** Group rows sharing a superset id into one unit, placed at the first member. */
function toUnits(items: DraftExercise[]): DraftExercise[][] {
  const units: DraftExercise[][] = []
  const byGroup = new Map<string, DraftExercise[]>()
  for (const it of items) {
    const g = it.superset_group_id
    if (g && byGroup.has(g)) {
      byGroup.get(g)!.push(it)
      continue
    }
    const unit = [it]
    if (g) byGroup.set(g, unit)
    units.push(unit)
  }
  return units
}

/** Contiguous groups, and a "superset" of one is just an exercise. */
function normalize(items: DraftExercise[]): DraftExercise[] {
  const flat = toUnits(items).flat()
  const counts = new Map<string, number>()
  for (const it of flat) if (it.superset_group_id) counts.set(it.superset_group_id, (counts.get(it.superset_group_id) ?? 0) + 1)
  return flat.map((it) =>
    it.superset_group_id && (counts.get(it.superset_group_id) ?? 0) < 2 ? { ...it, superset_group_id: null } : it,
  )
}

function summary(it: DraftExercise): string {
  return `${it.default_sets} × ${it.default_reps}${it.default_weight != null ? ` × ${fmtWeight(it.default_weight)}` : ''}`
}

function NumInput({
  label,
  value,
  onChange,
  integer,
  placeholder,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  integer?: boolean
  placeholder?: string
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  return (
    <label className="block">
      <div className="label mb-2">{label}</div>
      <input
        className="field font-mono"
        inputMode={integer ? 'numeric' : 'decimal'}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => {
          const raw = e.target.value.replace(integer ? /[^\d]/g : /[^\d.]/g, '')
          setDraft(raw)
          const n = numOrNull(raw)
          onChange(n == null ? null : integer ? Math.round(n) : n)
        }}
      />
    </label>
  )
}

function DefaultsSheet({
  item,
  onClose,
  onChange,
}: {
  item: DraftExercise | null
  onClose: () => void
  onChange: (patch: Partial<DraftExercise>) => void
}) {
  return (
    <Sheet open={!!item} onClose={onClose} eyebrow="Defaults" title={item?.name}>
      {item && (
        <div key={item.key} className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <NumInput label="Sets" integer value={item.default_sets} onChange={(v) => onChange({ default_sets: Math.max(1, v ?? 1) })} />
            <NumInput label="Reps" integer value={item.default_reps} onChange={(v) => onChange({ default_reps: Math.max(1, v ?? 1) })} />
            <NumInput label="Weight" value={item.default_weight} placeholder="—" onChange={(v) => onChange({ default_weight: v })} />
          </div>
          <div>
            <div className="label mb-2">Rest</div>
            <Segmented options={REST_OPTIONS} value={item.rest_seconds} onChange={(v) => onChange({ rest_seconds: v })} />
          </div>
          <label className="block">
            <div className="label mb-2">Notes</div>
            <textarea
              className="field min-h-[80px] resize-none"
              placeholder="Cues, setup, tempo…"
              defaultValue={item.notes ?? ''}
              onChange={(e) => onChange({ notes: e.target.value.trim() ? e.target.value : null })}
            />
          </label>
          <Button full size="lg" onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Sheet>
  )
}

interface Props {
  /** null = new template */
  templateId: string | null
  folderId?: string | null
  onClose: () => void
}

export function TemplateEditor({ templateId, folderId, onClose }: Props) {
  const { byId, loading } = useTemplates()
  const { byId: exerciseById, loading: exLoading } = useExercises()
  const [name, setName] = useState('')
  const [items, setItems] = useState<DraftExercise[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [groupMenu, setGroupMenu] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = useRef(false)

  // Seed the draft once the template and exercise names have loaded.
  useEffect(() => {
    if (ready.current) return
    if (!templateId) {
      ready.current = true
      return
    }
    if (loading || exLoading) return
    const t = byId.get(templateId)
    if (!t) return
    ready.current = true
    setName(t.name)
    setItems(
      normalize(
        t.exercises.map((e) => ({
          key: uid(),
          exercise_id: e.exercise_id,
          name: exerciseById.get(e.exercise_id)?.name ?? 'Exercise',
          default_sets: e.default_sets,
          default_reps: e.default_reps,
          default_weight: e.default_weight,
          rest_seconds: e.rest_seconds,
          notes: e.notes,
          superset_group_id: e.superset_group_id,
        })),
      ),
    )
  }, [templateId, byId, exerciseById, loading, exLoading])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const units = useMemo(() => toUnits(items), [items])
  const drag = useDragReorder((from, to) => setItems((cur) => moveItem(toUnits(cur), from, to).flat()))
  const editingItem = items.find((i) => i.key === editing) ?? null

  const patch = (key: string, p: Partial<DraftExercise>) =>
    setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...p } : i)))

  const toggleSelect = (key: string) =>
    setSelected((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  function groupSelected() {
    const gid = uid()
    // Absorb any groups the picked rows already belong to.
    const absorbed = new Set(items.filter((i) => selected.has(i.key) && i.superset_group_id).map((i) => i.superset_group_id))
    const members = items.filter((i) => selected.has(i.key) || (i.superset_group_id && absorbed.has(i.superset_group_id)))
    const at = items.findIndex((i) => members.includes(i))
    const rest = items.filter((i) => !members.includes(i))
    const before = items.slice(0, at).filter((i) => !members.includes(i)).length
    const grouped = members.map((m) => ({ ...m, superset_group_id: gid }))
    setItems(normalize([...rest.slice(0, before), ...grouped, ...rest.slice(before)]))
    setSelected(new Set())
  }

  function ungroup(gid: string) {
    setItems((cur) => cur.map((i) => (i.superset_group_id === gid ? { ...i, superset_group_id: null } : i)))
  }

  function removeItem(key: string) {
    setItems((cur) => normalize(cur.filter((i) => i.key !== key)))
    setSelected((cur) => {
      const next = new Set(cur)
      next.delete(key)
      return next
    })
  }

  async function save() {
    if (!name.trim()) {
      setError('Give the template a name')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveTemplate({
        id: templateId,
        name: name.trim(),
        folderId,
        exercises: normalize(items).map(({ key: _k, name: _n, ...row }) => row),
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save')
      setSaving(false)
    }
  }

  const row = (it: DraftExercise, unitIdx: number, inGroup: boolean, first: boolean) => {
    const isSel = selected.has(it.key)
    return (
      <div
        key={it.key}
        className={`flex items-center gap-1 py-2 pl-1 pr-2 ${first ? '' : inGroup ? 'border-t border-gold-border/60' : 'border-t border-line'}`}
      >
        <span {...drag.handle(unitIdx)} aria-label="Drag to reorder" className="flex h-10 w-7 shrink-0 items-center justify-center text-ink-3">
          <GripVertical size={16} />
        </span>
        <button
          type="button"
          aria-label={isSel ? 'Deselect' : 'Select'}
          onClick={() => toggleSelect(it.key)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            isSel ? 'border-gold bg-gold text-bg' : 'border-[#2a2a2a] text-transparent'
          }`}
        >
          <Check size={12} strokeWidth={3} />
        </button>
        <button type="button" onClick={() => setEditing(it.key)} className="min-w-0 flex-1 px-2 text-left">
          <div className="truncate text-[15px] text-ink">{it.name}</div>
          <div className="font-mono text-[12px] text-ink-2">
            {summary(it)}
            <span className="text-ink-3"> · {it.rest_seconds}s</span>
          </div>
        </button>
        <button
          type="button"
          aria-label={`Remove ${it.name}`}
          onClick={() => removeItem(it.key)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-set text-ink-2 transition-colors hover:text-danger active:text-danger"
        >
          <Trash2 size={15} />
        </button>
      </div>
    )
  }

  return createPortal(
    <div className="animate-fade-in fixed inset-0 z-40 overflow-y-auto bg-bg">
      <div
        className="mx-auto max-w-lg px-5"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}
      >
        <div className="mb-4 flex items-center justify-between">
          <button onClick={onClose} aria-label="Close" className="-ml-1 flex h-9 w-9 items-center justify-center text-ink-2 hover:text-ink">
            <X size={20} />
          </button>
          <span className="eyebrow">{templateId ? 'Edit template' : 'New template'}</span>
          <Button size="sm" onClick={save} disabled={saving} className="font-display uppercase tracking-[0.12em]">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name"
          aria-label="Template name"
          className="w-full border-b border-line bg-transparent pb-2 font-display text-[28px] font-extrabold leading-tight text-ink outline-none transition-colors placeholder:text-ink-3 focus:border-gold-border"
        />
        {error && <p className="mt-3 text-[13px] text-danger">{error}</p>}

        <div className="mb-2 mt-6 flex items-center justify-between">
          <span className="label">{items.length} exercise{items.length === 1 ? '' : 's'}</span>
          {items.length > 1 && <span className="font-mono text-[11px] text-ink-3">Select 2+ to superset</span>}
        </div>

        <div className="space-y-2">
          {units.map((unit, u) => {
            const gid = unit[0].superset_group_id
            return (
              <div
                key={gid ?? unit[0].key}
                ref={drag.register(u)}
                className={`overflow-hidden rounded-card border bg-elevated transition-opacity ${
                  gid ? 'border-gold-border' : 'border-line'
                } ${drag.dragging === u ? 'opacity-70 ring-1 ring-gold-border' : ''}`}
              >
                {gid && (
                  <button
                    type="button"
                    onClick={() => setGroupMenu(gid)}
                    className="flex w-full items-center gap-1.5 px-4 pt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-gold"
                  >
                    <Layers size={11} /> Superset
                  </button>
                )}
                {unit.map((it, i) => row(it, u, !!gid, i === 0))}
              </div>
            )
          })}
        </div>

        <Button variant="outline" full className="mt-4" onClick={() => setPicking(true)}>
          <Plus size={15} /> Add Exercise
        </Button>
      </div>

      {selected.size >= 2 && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg px-5"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
        >
          <Button full size="lg" onClick={groupSelected} className="shadow-[0_8px_30px_rgba(200,160,80,0.25)]">
            <Layers size={16} /> Group as Superset ({selected.size})
          </Button>
        </div>
      )}

      <DefaultsSheet item={editingItem} onClose={() => setEditing(null)} onChange={(p) => editing && patch(editing, p)} />

      <Sheet open={!!groupMenu} onClose={() => setGroupMenu(null)} eyebrow="Superset" title="Superset group">
        <ActionList
          items={[
            {
              label: 'Remove Superset Group',
              tone: 'danger',
              onSelect: () => {
                if (groupMenu) ungroup(groupMenu)
                setGroupMenu(null)
              },
            },
          ]}
        />
      </Sheet>

      <ExercisePicker
        open={picking}
        filterable
        onClose={() => setPicking(false)}
        onPick={(ex) => {
          setItems((cur) => [
            ...cur,
            {
              key: uid(),
              exercise_id: ex.id,
              name: ex.name,
              default_sets: 3,
              default_reps: 10,
              default_weight: null,
              rest_seconds: 90,
              notes: null,
              superset_group_id: null,
            },
          ])
          setPicking(false)
        }}
      />
    </div>,
    document.body,
  )
}
