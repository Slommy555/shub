import { NavLink } from 'react-router-dom'
import { BarChart3, BookOpen, CalendarDays, Dumbbell, Scale } from 'lucide-react'

const tabs = [
  { to: '/log', label: 'Log', icon: Dumbbell },
  { to: '/program', label: 'Program', icon: CalendarDays },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/body', label: 'Body', icon: Scale },
  { to: '/library', label: 'Library', icon: BookOpen },
]

export const NAV_HEIGHT = 64

export function Nav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-muted bg-bg/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-lg" style={{ height: NAV_HEIGHT }}>
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex min-w-0 flex-1 flex-col items-center justify-center"
          >
            {({ isActive }) => (
              <>
                <span
                  className={`mb-1.5 h-[5px] w-[5px] rotate-45 transition-opacity duration-200 ${isActive ? 'bg-gold opacity-100' : 'opacity-0'}`}
                />
                <Icon size={19} strokeWidth={1.6} className={isActive ? 'text-ink' : 'text-ink-2'} />
                <span
                  className={`mt-1 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.08em] ${isActive ? 'text-gold' : 'text-ink-2'}`}
                >
                  {label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
