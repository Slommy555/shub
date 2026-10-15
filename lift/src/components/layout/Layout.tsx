import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Nav, NAV_HEIGHT } from './Nav'

export function Layout() {
  return (
    <div
      className="mx-auto min-h-[100dvh] max-w-lg bg-bg"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: `calc(env(safe-area-inset-bottom) + ${NAV_HEIGHT + 24}px)`,
      }}
    >
      <Outlet />
      <Nav />
    </div>
  )
}

/** Standard page header: Syne title left, optional slot right. */
export function PageHeader({ title, right, gold }: { title: string; right?: ReactNode; gold?: boolean }) {
  return (
    <header className="flex items-end justify-between px-5 pb-4 pt-6">
      <h1
        className={`font-display text-[28px] font-extrabold leading-none tracking-tight ${gold ? 'text-gold' : 'text-ink'}`}
      >
        {title}
      </h1>
      {right}
    </header>
  )
}
