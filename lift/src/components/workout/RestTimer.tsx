import { useEffect, useRef } from 'react'
import { useNow, useWorkoutSession } from '../../hooks/useWorkoutSession'
import { fmtClock } from '../../lib/format'
import { NAV_HEIGHT } from '../layout/Nav'
import { Button } from '../ui/Button'

/** Bottom bar during a session: rest countdown + Finish Workout. */
export function RestTimer({ onFinish }: { onFinish: () => void }) {
  const { live, dismissRest, adjustRest } = useWorkoutSession()
  const now = useNow(250)
  const endsAt = live?.restEndsAt ?? null
  const remaining = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0
  const resting = endsAt != null && remaining > 0
  const buzzed = useRef<number | null>(null)

  useEffect(() => {
    if (endsAt && remaining === 0 && buzzed.current !== endsAt) {
      buzzed.current = endsAt
      navigator.vibrate?.([120, 80, 120])
      dismissRest()
    }
  }, [endsAt, remaining, dismissRest])

  if (!live) return null
  const pct = resting && live.restTotal ? remaining / live.restTotal : 0

  return (
    <div
      className="fixed inset-x-0 z-20 border-t border-line bg-bg/95 backdrop-blur"
      style={{ bottom: `calc(env(safe-area-inset-bottom) + ${NAV_HEIGHT}px)` }}
    >
      {resting && (
        <div className="h-[2px] w-full bg-line-muted">
          <div
            className="h-full transition-[width] duration-300 ease-linear"
            style={{ width: `${pct * 100}%`, background: 'linear-gradient(90deg, #a07030, #c8a050)' }}
          />
        </div>
      )}
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        {resting ? (
          <div className="flex flex-1 items-center gap-2">
            <button
              onClick={dismissRest}
              aria-label="Dismiss rest timer"
              className="flex h-11 items-center gap-2 rounded-btn border border-gold-border bg-gold-dim px-3.5 font-mono text-[15px] text-gold"
            >
              <span className="text-[11px] tracking-[0.18em]">REST</span>
              <span className="tabular-nums">{fmtClock(remaining)}</span>
            </button>
            <button onClick={() => adjustRest(-15)} className="h-11 px-2 font-mono text-[12px] text-ink-2 hover:text-ink">
              −15
            </button>
            <button onClick={() => adjustRest(15)} className="h-11 px-2 font-mono text-[12px] text-ink-2 hover:text-ink">
              +15
            </button>
          </div>
        ) : (
          <div className="flex-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">Tick a set to rest</div>
        )}
        <Button onClick={onFinish} size="md" className="shrink-0">
          Finish Workout
        </Button>
      </div>
    </div>
  )
}
