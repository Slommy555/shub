import { TABS, type Tab } from './nav/tabs';

export type { Tab };

interface Props {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

/**
 * The desktop navigation rail. Phones don't get a sidebar at all — they use the
 * bottom dock (MobileDock) plus left/right swipes instead.
 */
export default function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="glass sticky top-0 hidden h-screen w-20 shrink-0 flex-col gap-1.5 border-r px-2 py-4 sm:flex">
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onSelect(t.id)}
            aria-label={t.label}
            aria-current={on ? 'page' : undefined}
            // Settings sinks to the bottom of the rail.
            className={[
              t.id === 'settings' ? 'mt-auto' : '',
              'group relative flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[10px] font-semibold transition-all duration-200',
              on
                ? 'bg-gradient-to-b from-accent-500 to-accent-600 text-white shadow-glow'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100',
            ].join(' ')}
          >
            <span
              className={`grid h-6 w-6 place-items-center transition-transform duration-200 ${
                on ? '' : 'group-hover:-translate-y-0.5'
              }`}
            >
              {t.icon}
            </span>
            {t.label}
          </button>
        );
      })}
    </aside>
  );
}
