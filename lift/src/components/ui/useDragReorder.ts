import { useCallback, useRef, useState } from 'react'
import type { PointerEvent } from 'react'

/**
 * Vertical drag-to-reorder driven by a handle. The list reorders live as the
 * pointer crosses a neighbour's midpoint; `onEnd` fires once on release.
 */
export function useDragReorder(onMove: (from: number, to: number) => void, onEnd?: () => void) {
  const rows = useRef<(HTMLElement | null)[]>([])
  const from = useRef<number | null>(null)
  const [dragging, setDragging] = useState<number | null>(null)

  const register = useCallback(
    (i: number) => (el: HTMLElement | null) => {
      rows.current[i] = el
    },
    [],
  )

  const finish = () => {
    if (from.current == null) return
    from.current = null
    setDragging(null)
    onEnd?.()
  }

  const handle = (i: number) => ({
    style: { touchAction: 'none' as const, cursor: 'grab' },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      e.preventDefault()
      e.stopPropagation()
      e.currentTarget.setPointerCapture(e.pointerId)
      from.current = i
      setDragging(i)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      const cur = from.current
      if (cur == null) return
      // Target index = how many other rows sit above the pointer.
      let to = 0
      rows.current.forEach((el, j) => {
        if (!el || j === cur) return
        const r = el.getBoundingClientRect()
        if (r.top + r.height / 2 < e.clientY) to++
      })
      if (to !== cur) {
        onMove(cur, to)
        from.current = to
        setDragging(to)
      }
    },
    onPointerUp: finish,
    onPointerCancel: finish,
    onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  })

  return { register, handle, dragging }
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
