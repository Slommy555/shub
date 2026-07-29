import { haptic } from '../lib/native';
import { TABS, type Tab } from './nav/tabs';

interface Props {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

/**
 * The phone navigation dock — a floating glass bar pinned to the bottom of the
 * screen. Tap an icon to jump to a tab; the active one expands into a labelled
 * accent pill. Swiping the page left/right moves between the same tabs in this
 * order (see useSwipeNav). Hidden on `sm` and up, where the sidebar rail takes
 * over.
 */
export default function MobileDock({ active, onSelect }: Props) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 px-3 pt-2 sm:hidden"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
    >
      <div className="glass mx-auto flex max-w-md items-center justify-between gap-0.5 rounded-[1.4rem] border px-1.5 py-1.5 shadow-pop">
        {TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                if (!on) haptic();
                onSelect(t.id);
              }}
              aria-label={t.label}
              aria-current={on ? 'page' : undefined}
              className={[
                'flex h-11 items-center justify-center gap-1.5 rounded-2xl transition-all duration-200 ease-out',
                on
                  ? 'min-w-0 flex-1 bg-gradient-to-b from-accent-500 to-accent-600 px-2.5 text-accentfg shadow-glow'
                  : 'w-10 shrink-0 text-gray-500 active:scale-90 active:bg-gray-100 dark:text-gray-400 dark:active:bg-gray-800',
              ].join(' ')}
            >
              <span className="shrink-0">{t.icon}</span>
              {on && (
                <span className="truncate text-[11px] font-semibold tracking-tight">{t.label}</span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
