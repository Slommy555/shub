export type Tab = 'todo' | 'voice' | 'workout' | 'budget' | 'savings' | 'productivity' | 'notes' | 'settings';

interface Props {
  active: Tab;
  onSelect: (tab: Tab) => void;
  /** Mobile drawer open state. On desktop the sidebar is always visible. */
  open?: boolean;
  /** Close the mobile drawer (tap a nav item or the backdrop). */
  onClose?: () => void;
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

export default function Sidebar({ active, onSelect, open = false, onClose }: Props) {
  // On mobile, selecting a tab also closes the drawer.
  const select = (tab: Tab) => {
    onSelect(tab);
    onClose?.();
  };

  return (
    <>
      {/* Backdrop (mobile only, when the drawer is open). Tap to close. The blur
          is set inline with the -webkit- prefix so iOS Safari actually frosts the
          page behind the drawer instead of just dimming it. */}
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onClose}
          className="fixed inset-0 z-40 sm:hidden"
          style={{
            background: 'rgba(17, 24, 39, 0.3)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        />
      )}

      <aside
        className={[
          'flex h-screen w-20 shrink-0 flex-col gap-1.5 border-r border-gray-200 bg-white px-2 py-4 dark:border-gray-800 dark:bg-gray-950',
          // Mobile: off-canvas fixed drawer that slides in over the content.
          'fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop (sm+): always-visible in-flow sticky rail.
          'sm:sticky sm:top-0 sm:z-auto sm:translate-x-0',
        ].join(' ')}
      >
      <NavButton active={active === 'todo'} label="To-Do" onClick={() => select('todo')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6h11M9 12h11M9 18h11" />
          <path d="m4 6 1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" />
        </svg>
      </NavButton>

      <NavButton active={active === 'voice'} label="Voice" onClick={() => select('voice')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8" />
        </svg>
      </NavButton>

      <NavButton active={active === 'workout'} label="Workout" onClick={() => select('workout')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 6.5 17.5 17.5M4 8l-1 1 2 2M20 16l1-1-2-2" />
          <path d="m7 4-1 1 4 4M17 20l1-1-4-4" />
          <path d="M3.5 14.5 9.5 8.5M14.5 15.5 20.5 9.5" />
        </svg>
      </NavButton>

      <NavButton active={active === 'budget'} label="Budget" onClick={() => select('budget')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      </NavButton>

      <NavButton active={active === 'savings'} label="Savings" onClick={() => select('savings')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.4-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z" />
          <path d="M2 9v1c0 1.1.9 2 2 2h1M16 11h0" />
        </svg>
      </NavButton>

      <NavButton
        active={active === 'productivity'}
        label="Focus"
        onClick={() => select('productivity')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m7 14 3-3 3 3 5-5" />
        </svg>
      </NavButton>

      <NavButton active={active === 'notes'} label="Notes" onClick={() => select('notes')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M8 13h8M8 17h5" />
        </svg>
      </NavButton>

      <div className="mt-auto">
        <NavButton
          active={active === 'settings'}
          label="Settings"
          onClick={() => select('settings')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </NavButton>
      </div>
      </aside>
    </>
  );
}
