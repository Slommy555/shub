import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, ClipboardList, FolderPlus, GripVertical } from 'lucide-react'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { ActionList, Sheet } from '../ui/Sheet'
import { Skeleton } from '../ui/Skeleton'
import { useLongPress } from '../ui/useLongPress'
import { moveItem, useDragReorder } from '../ui/useDragReorder'
import { useProgram } from '../../hooks/useProgram'
import { useTemplates } from '../../hooks/useTemplates'
import type { TemplateWithExercises } from '../../hooks/useTemplates'
import { useTemplateFolders, useTemplateLastUsed } from '../../hooks/useTemplateFolders'
import { shortDate } from '../../lib/format'
import type { TemplateFolder } from '../../lib/types'

function TemplateRow({
  template,
  inProgram,
  lastUsed,
  first,
  onOpen,
  onLongPress,
}: {
  template: TemplateWithExercises
  inProgram: boolean
  lastUsed: string | undefined
  first: boolean
  onOpen: () => void
  onLongPress: () => void
}) {
  const { handlers, didFire } = useLongPress(onLongPress)
  const n = template.exercises.length
  return (
    <button
      {...handlers}
      onClick={() => !didFire() && onOpen()}
      className={`flex w-full select-none items-center gap-3 bg-elevated px-4 py-3 text-left hover:bg-[#121212] ${
        inProgram ? 'gold-strip' : ''
      } ${first ? '' : 'border-t border-line'}`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium text-ink">{template.name}</div>
        <div className="mt-0.5 font-mono text-[12px] text-ink-2">
          {n} exercise{n === 1 ? '' : 's'}
          <span className="text-ink-3"> · {lastUsed ? `last ${shortDate(lastUsed)}` : 'never used'}</span>
        </div>
      </div>
      <ChevronRight size={15} className="shrink-0 text-ink-3" />
    </button>
  )
}

function FolderHeader({
  folder,
  count,
  collapsed,
  onToggle,
  onLongPress,
  handle,
}: {
  folder: TemplateFolder
  count: number
  collapsed: boolean
  onToggle: () => void
  onLongPress: () => void
  handle: ReturnType<ReturnType<typeof useDragReorder>['handle']>
}) {
  const { handlers, didFire } = useLongPress(onLongPress)
  return (
    <div className="mb-2 flex items-center gap-1">
      <span {...handle} aria-label="Drag to reorder folder" className="-ml-2 flex h-8 w-7 items-center justify-center text-ink-3">
        <GripVertical size={14} />
      </span>
      <button {...handlers} onClick={() => !didFire() && onToggle()} className="flex flex-1 select-none items-center gap-1.5 py-1 text-left">
        {collapsed ? <ChevronRight size={14} className="text-ink-2" /> : <ChevronDown size={14} className="text-ink-2" />}
        <span className="label">{folder.name}</span>
        <span className="font-mono text-[11px] text-ink-3">{count}</span>
      </button>
    </div>
  )
}

function NameSheet({
  open,
  title,
  initial,
  cta,
  onClose,
  onSubmit,
}: {
  open: boolean
  title: string
  initial: string
  cta: string
  onClose: () => void
  onSubmit: (name: string) => Promise<void>
}) {
  return (
    <Sheet open={open} onClose={onClose} eyebrow="Folder" title={title}>
      {open && <NameForm initial={initial} cta={cta} onSubmit={onSubmit} />}
    </Sheet>
  )
}

function NameForm({ initial, cta, onSubmit }: { initial: string; cta: string; onSubmit: (name: string) => Promise<void> }) {
  const [name, setName] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim()) return
        setSaving(true)
        setError(null)
        try {
          await onSubmit(name.trim())
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not save')
          setSaving(false)
        }
      }}
    >
      <input autoFocus className="field" placeholder="e.g. Push / Pull / Legs" value={name} onChange={(e) => setName(e.target.value)} />
      {error && <p className="text-[13px] text-danger">{error}</p>}
      <Button full size="lg" type="submit" disabled={!name.trim() || saving}>
        {saving ? 'Saving…' : cta}
      </Button>
    </form>
  )
}

export function TemplateList({ onEdit }: { onEdit: (templateId: string) => void }) {
  const { templates, loading, remove, moveToFolder } = useTemplates()
  const { folders, setFolders, create, rename, remove: removeFolder, reorder } = useTemplateFolders()
  const lastUsed = useTemplateLastUsed()
  const { active, daysFor } = useProgram()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = useState<TemplateWithExercises | null>(null)
  const [movingFor, setMovingFor] = useState<TemplateWithExercises | null>(null)
  const [deletingFor, setDeletingFor] = useState<TemplateWithExercises | null>(null)
  const [folderMenu, setFolderMenu] = useState<TemplateFolder | null>(null)
  const [naming, setNaming] = useState<{ folder: TemplateFolder | null } | null>(null)
  const [deletingFolder, setDeletingFolder] = useState<TemplateFolder | null>(null)
  const [error, setError] = useState<string | null>(null)

  const programIds = useMemo(
    () => new Set(active ? daysFor(active.id).map((d) => d.template_id).filter(Boolean) as string[] : []),
    [active, daysFor],
  )
  const folderIds = useMemo(() => new Set(folders.map((f) => f.id)), [folders])
  const uncategorized = templates.filter((t) => !t.folder_id || !folderIds.has(t.folder_id))

  const drag = useDragReorder(
    (from, to) => setFolders((cur) => moveItem(cur, from, to)),
    () => reorder(folders).catch((e) => setError(e instanceof Error ? e.message : 'Could not reorder')),
  )

  const list = (items: TemplateWithExercises[]) => (
    <div className="overflow-hidden rounded-card border border-line">
      {items.map((t, i) => (
        <TemplateRow
          key={t.id}
          template={t}
          inProgram={programIds.has(t.id)}
          lastUsed={lastUsed.get(t.id)}
          first={i === 0}
          onOpen={() => onEdit(t.id)}
          onLongPress={() => setMenuFor(t)}
        />
      ))}
    </div>
  )

  if (loading) return <Skeleton className="h-40" />

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setNaming({ folder: null })}>
          <FolderPlus size={14} /> New Folder
        </Button>
      </div>
      {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}

      {!templates.length && !folders.length ? (
        <EmptyState icon={ClipboardList} title="No templates yet" body="Build a workout once, start it any day." />
      ) : (
        <div className="space-y-6">
          <section>
            <div className="label mb-2">All Templates</div>
            {uncategorized.length ? (
              list(uncategorized)
            ) : (
              <p className="rounded-card border border-dashed border-line px-4 py-4 text-center font-mono text-[12px] text-ink-3">
                Every template is in a folder
              </p>
            )}
          </section>

          {folders.map((f, i) => {
            const items = templates.filter((t) => t.folder_id === f.id)
            const isCollapsed = collapsed.has(f.id)
            return (
              <section
                key={f.id}
                ref={drag.register(i)}
                className={`transition-opacity ${drag.dragging === i ? 'opacity-70' : ''}`}
              >
                <FolderHeader
                  folder={f}
                  count={items.length}
                  collapsed={isCollapsed}
                  handle={drag.handle(i)}
                  onToggle={() =>
                    setCollapsed((cur) => {
                      const next = new Set(cur)
                      if (next.has(f.id)) next.delete(f.id)
                      else next.add(f.id)
                      return next
                    })
                  }
                  onLongPress={() => setFolderMenu(f)}
                />
                {!isCollapsed &&
                  (items.length ? (
                    list(items)
                  ) : (
                    <p className="rounded-card border border-dashed border-line px-4 py-4 text-center font-mono text-[12px] text-ink-3">
                      Empty folder · long-press a template to move it here
                    </p>
                  ))}
              </section>
            )
          })}
          <p className="pb-2 text-center text-[11px] text-ink-2">Long-press a template or folder for options</p>
        </div>
      )}

      {/* Template actions */}
      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} eyebrow="Template" title={menuFor?.name}>
        <ActionList
          items={[
            { label: 'Edit', onSelect: () => { if (menuFor) onEdit(menuFor.id); setMenuFor(null) } },
            { label: 'Move to Folder', onSelect: () => { setMovingFor(menuFor); setMenuFor(null) } },
            { label: 'Delete', tone: 'danger', onSelect: () => { setDeletingFor(menuFor); setMenuFor(null) } },
          ]}
        />
      </Sheet>

      <Sheet open={!!movingFor} onClose={() => setMovingFor(null)} eyebrow="Move to folder" title={movingFor?.name}>
        <ActionList
          items={[
            { id: null as string | null, name: 'All Templates (no folder)' },
            ...folders.map((f) => ({ id: f.id as string | null, name: f.name })),
          ].map((opt) => ({
            label: opt.name,
            active: (movingFor?.folder_id ?? null) === opt.id,
            tone: (opt.id ? 'default' : 'muted') as 'default' | 'muted',
            onSelect: async () => {
              const t = movingFor
              setMovingFor(null)
              if (t) await moveToFolder(t.id, opt.id).catch((e) => setError(e instanceof Error ? e.message : 'Could not move'))
            },
          }))}
        />
      </Sheet>

      <Sheet open={!!deletingFor} onClose={() => setDeletingFor(null)} eyebrow="Delete" title={deletingFor ? `Delete ${deletingFor.name}?` : ''}>
        <p className="mb-5 text-[14px] text-ink-2">
          {deletingFor && programIds.has(deletingFor.id)
            ? 'It is scheduled in your active program; those days become empty. Logged sessions are kept.'
            : 'Logged sessions are kept.'}
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setDeletingFor(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            full
            onClick={async () => {
              const t = deletingFor
              setDeletingFor(null)
              if (t) await remove(t.id).catch((e) => setError(e instanceof Error ? e.message : 'Could not delete'))
            }}
          >
            Delete
          </Button>
        </div>
      </Sheet>

      {/* Folder actions */}
      <Sheet open={!!folderMenu} onClose={() => setFolderMenu(null)} eyebrow="Folder" title={folderMenu?.name}>
        <ActionList
          items={[
            { label: 'Rename', onSelect: () => { setNaming({ folder: folderMenu }); setFolderMenu(null) } },
            { label: 'Delete Folder', tone: 'danger', onSelect: () => { setDeletingFolder(folderMenu); setFolderMenu(null) } },
          ]}
        />
      </Sheet>

      <NameSheet
        open={!!naming}
        title={naming?.folder ? 'Rename Folder' : 'New Folder'}
        initial={naming?.folder?.name ?? ''}
        cta={naming?.folder ? 'Rename' : 'Create'}
        onClose={() => setNaming(null)}
        onSubmit={async (name) => {
          if (naming?.folder) await rename(naming.folder.id, name)
          else await create(name)
          setNaming(null)
        }}
      />

      <Sheet
        open={!!deletingFolder}
        onClose={() => setDeletingFolder(null)}
        eyebrow="Delete"
        title={deletingFolder ? `Delete ${deletingFolder.name}?` : ''}
      >
        <p className="mb-5 text-[14px] text-ink-2">Its templates move to All Templates. No templates are deleted.</p>
        <div className="flex gap-3">
          <Button variant="ghost" full onClick={() => setDeletingFolder(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            full
            onClick={async () => {
              const f = deletingFolder
              setDeletingFolder(null)
              if (f) await removeFolder(f.id).catch((e) => setError(e instanceof Error ? e.message : 'Could not delete'))
            }}
          >
            Delete
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
