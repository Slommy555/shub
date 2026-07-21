import { useRef, useState, type ReactNode } from 'react';

/**
 * A row that reveals a Delete action when swiped left (or when the trailing area
 * is tapped after opening). Pointer starts on inputs/buttons are ignored so
 * inline editing still works; a vertical drag is abandoned so the page scrolls.
 */
export default function SwipeRow({ children, onDelete }: { children: ReactNode; onDelete: () => void }) {
  const [x, setX] = useState(0);
  const openRef = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input,button,select,[data-no-drag]')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let mode: 'pending' | 'swipe' = 'pending';

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (mode === 'pending') {
        if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) mode = 'swipe';
        else if (Math.abs(dy) > 8) return cleanup();
      }
      if (mode === 'swipe') {
        ev.preventDefault();
        const base = openRef.current ? -88 : 0;
        setX(Math.max(-96, Math.min(0, base + dx)));
      }
    };
    const up = () => {
      setX((cur) => {
        const open = cur < -48;
        openRef.current = open;
        return open ? -88 : 0;
      });
      cleanup();
    };
    function cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    }
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div className="relative select-none border-t" style={{ borderColor: 'var(--color-border)' }}>
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          data-no-drag
          type="button"
          onClick={() => {
            onDelete();
            openRef.current = false;
            setX(0);
          }}
          className="flex h-full items-center px-5 text-sm font-semibold"
          style={{ background: 'var(--color-danger)', color: '#fff' }}
        >
          Delete
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        className="relative"
        style={{
          transform: `translateX(${x}px)`,
          transition: 'transform 160ms ease',
          background: 'var(--color-bg-elevated)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
