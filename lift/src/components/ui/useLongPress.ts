import { useCallback, useRef } from 'react'
import type { MouseEvent, PointerEvent } from 'react'

/** Pointer long-press; cancels if the finger moves or lifts early. */
export function useLongPress(onLongPress: () => void, ms = 480) {
  const timer = useRef<number | null>(null)
  const origin = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const clear = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }, [])

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      fired.current = false
      origin.current = { x: e.clientX, y: e.clientY }
      clear()
      timer.current = window.setTimeout(() => {
        fired.current = true
        navigator.vibrate?.(10)
        onLongPress()
      }, ms)
    },
    onPointerMove: (e: PointerEvent) => {
      if (!origin.current) return
      if (Math.abs(e.clientX - origin.current.x) > 8 || Math.abs(e.clientY - origin.current.y) > 8) clear()
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
  }
  /** True if the last press turned into a long-press (use to swallow the click). */
  const didFire = () => fired.current
  return { handlers, didFire }
}
