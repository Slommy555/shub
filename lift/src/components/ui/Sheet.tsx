import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  title?: string
  eyebrow?: string
  children: ReactNode
  /** Disallow closing by tapping the backdrop. */
  locked?: boolean
}

export function Sheet({ open, onClose, title, eyebrow, children, locked }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !locked) onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose, locked])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="animate-fade-in absolute inset-0 bg-black/70" onClick={() => !locked && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        className="animate-sheet-in relative max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-[20px] border-t border-line bg-elevated px-5 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-[#222]" />
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        {title && <h2 className="mb-4 font-display text-[22px] font-bold leading-tight text-ink">{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export interface ActionItem {
  label: string
  onSelect: () => void
  tone?: 'default' | 'danger' | 'muted' | 'warning'
  badge?: ReactNode
  active?: boolean
}

const tones = {
  default: 'text-ink',
  danger: 'text-danger',
  muted: 'text-ink-2',
  warning: 'text-warning',
}

/** A list of tappable actions inside a sheet. */
export function ActionList({ items }: { items: ActionItem[] }) {
  return (
    <div className="overflow-hidden rounded-card border border-line">
      {items.map((it, i) => (
        <button
          key={it.label}
          onClick={it.onSelect}
          className={`flex w-full items-center gap-3 bg-subtle px-4 py-3.5 text-left text-[15px] transition-colors hover:bg-[#181818] ${tones[it.tone ?? 'default']} ${i > 0 ? 'border-t border-line' : ''}`}
        >
          {it.badge && <span className="w-11 shrink-0">{it.badge}</span>}
          <span className="flex-1">{it.label}</span>
          {it.active && <span className="h-[5px] w-[5px] rotate-45 bg-gold" />}
        </button>
      ))}
    </div>
  )
}
