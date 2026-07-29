import { useCallback, useRef } from 'react';

/** How far a horizontal drag must travel (px) before it changes tab. */
const COMMIT_PX = 64;
/** Movement below this is still "undecided" — we haven't picked an axis yet. */
const AXIS_PX = 12;
/** A swipe only counts as horizontal if it out-runs the vertical drift. */
const AXIS_RATIO = 1.4;
/** Cap on the rubber-band follow so the page barely moves — just a hint. */
const FOLLOW_MAX = 48;

/**
 * True when the touch started somewhere that owns horizontal gestures itself:
 * a scrollable strip (sub-nav chips, wide tables), a dnd-kit drag handle
 * (`touch-none`), a form control, or anything explicitly opted out.
 */
function ownsGesture(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body) {
    if (el.closest?.('[data-no-swipe]')) return true;
    const cls = el.classList;
    if (cls?.contains('touch-none')) return true;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el instanceof HTMLElement && el.isContentEditable) return true; // notes editor
    if (el.scrollWidth > el.clientWidth + 2) {
      const overflowX = getComputedStyle(el).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Left/right swipe navigation for the phone layout. Returns a ref to put on the
 * content wrapper plus the touch handlers. While a horizontal swipe is in
 * progress the wrapper is nudged directly through the DOM node (no React state)
 * so dragging never re-renders the whole page.
 */
export function useSwipeNav({
  enabled,
  index,
  count,
  onChange,
}: {
  enabled: boolean;
  index: number;
  count: number;
  onChange: (nextIndex: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'none' | 'x' | 'y'>('none');

  const setShift = useCallback((dx: number, animate: boolean) => {
    const node = ref.current;
    if (!node) return;
    node.style.transition = animate ? 'transform 0.18s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    node.style.transform = dx ? `translateX(${dx}px)` : '';
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || e.touches.length !== 1) {
        start.current = null;
        return;
      }
      if (ownsGesture(e.target)) {
        start.current = null;
        return;
      }
      axis.current = 'none';
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    [enabled]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const s = start.current;
      if (!s) return;
      const dx = e.touches[0].clientX - s.x;
      const dy = e.touches[0].clientY - s.y;

      if (axis.current === 'none') {
        if (Math.abs(dy) > AXIS_PX && Math.abs(dy) > Math.abs(dx)) {
          axis.current = 'y'; // vertical scroll wins — stay out of the way
          return;
        }
        if (Math.abs(dx) > AXIS_PX && Math.abs(dx) > Math.abs(dy) * AXIS_RATIO) {
          axis.current = 'x';
        } else {
          return;
        }
      }
      if (axis.current !== 'x') return;

      // Resist at the ends of the tab list so the edges feel like edges.
      const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === count - 1);
      const follow = Math.max(-FOLLOW_MAX, Math.min(FOLLOW_MAX, dx * (atEdge ? 0.12 : 0.28)));
      setShift(follow, false);
    },
    [count, index, setShift]
  );

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || axis.current !== 'x') {
        setShift(0, true);
        return;
      }
      axis.current = 'none';
      const dx = (e.changedTouches[0]?.clientX ?? s.x) - s.x;
      setShift(0, true);
      if (Math.abs(dx) < COMMIT_PX) return;
      const next = dx < 0 ? index + 1 : index - 1;
      if (next >= 0 && next < count) onChange(next);
    },
    [count, index, onChange, setShift]
  );

  return { ref, handlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd } };
}
