import { useEffect, useState } from 'react';

export interface MenuItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

/**
 * A right-click menu anchored at a screen position. Renders a full-screen
 * backdrop that dismisses on any click or Escape. Position is clamped so the
 * menu stays on-screen.
 */
export default function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const menuW = 200;
    const menuH = items.length * 42 + 10;
    setPos({
      x: Math.max(8, Math.min(x, window.innerWidth - menuW - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - menuH - 8)),
    });
  }, [x, y, items.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div
        className="absolute min-w-[11.5rem] animate-pop-in overflow-hidden rounded-2xl border border-gray-200 bg-white/95 py-1.5 shadow-pop backdrop-blur-xl dark:border-gray-700 dark:bg-gray-900/95"
        style={{ left: pos.x, top: pos.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className={[
              'block w-full px-3.5 py-2.5 text-left text-sm font-medium transition-colors',
              item.danger
                ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
                : 'text-gray-700 hover:bg-accent-50 hover:text-accent-800 dark:text-gray-200 dark:hover:bg-accent-500/15 dark:hover:text-accent-100',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
