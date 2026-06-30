export type Tab = 'todo' | 'voice' | 'workout' | 'productivity' | 'reminders' | 'settings';

interface Props {
  active: Tab;
  onSelect: (tab: Tab) => void;
}

function NavButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex w-full flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium transition-colors',
        active
          ? 'bg-gray-800 text-white shadow-sm shadow-gray-500/30'
          : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      <span className="grid h-6 w-6 place-items-center">{children}</span>
      {label}
    </button>
  );
}

export default function Sidebar({ active, onSelect }: Props) {
  return (
    <aside className="sticky top-0 flex h-screen w-20 shrink-0 flex-col gap-1.5 border-r border-gray-200 bg-white px-2 py-4 dark:border-gray-800 dark:bg-gray-950">
      <div className="mb-3 flex flex-col items-center gap-1">
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gray-800 shadow-lg shadow-gray-500/30">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 12.5l3.2 3.2L17 9" />
          </svg>
        </div>
        <span className="text-[11px] font-bold tracking-tight text-gray-700 dark:text-gray-200">S Hub</span>
      </div>

      <NavButton active={active === 'todo'} label="To-Do" onClick={() => onSelect('todo')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
        </svg>
      </NavButton>

      <NavButton active={active === 'voice'} label="Voice" onClick={() => onSelect('voice')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
        </svg>
      </NavButton>

      <NavButton active={active === 'workout'} label="Workout" onClick={() => onSelect('workout')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 6.5 17.5 17.5M4 8l-1 1 2 2M20 16l1-1-2-2" />
          <path d="m7 4-1 1 4 4M17 20l1-1-4-4" />
          <path d="M3.5 14.5 9.5 8.5M14.5 15.5 20.5 9.5" />
        </svg>
      </NavButton>

      <NavButton
        active={active === 'productivity'}
        label="Focus"
        onClick={() => onSelect('productivity')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m7 14 3-3 3 3 5-5" />
        </svg>
      </NavButton>

      <NavButton
        active={active === 'reminders'}
        label="Reminders"
        onClick={() => onSelect('reminders')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </NavButton>

      <div className="mt-auto">
        <NavButton
          active={active === 'settings'}
          label="Settings"
          onClick={() => onSelect('settings')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NavButton>
      </div>
    </aside>
  );
}
