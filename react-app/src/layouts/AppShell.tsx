import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuthStore } from '@/features/auth/store'
import { logout } from '@/features/auth/api'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/site-visits/new', label: 'Log a Visit' },
  { to: '/site-visits', label: 'Site Visits' },
  { to: '/leads', label: 'Leads' },
  { to: '/properties', label: 'Properties' },
  { to: '/attendance', label: 'Attendance' },
  { to: '/day-off', label: 'Day Off' },
  { to: '/notifications', label: 'Notifications' },
]

function Brand() {
  return (
    <div className="px-1">
      <p className="font-display text-sm font-semibold tracking-wide text-gold-400">DIVINE VISION</p>
      <p className="text-[10px] uppercase tracking-[0.2em] text-cream-100/60">Field Portal</p>
    </div>
  )
}

function SidebarContent({ onLogout, onNavigate }: { onLogout: () => void; onNavigate?: () => void }) {
  const employee = useAuthStore((s) => s.employee)
  return (
    <>
      <div>
        <Brand />

        <nav className="mt-8 flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard' || item.to === '/site-visits'}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm transition-colors lg:py-2',
                  isActive
                    ? 'bg-cream-100/10 font-semibold text-cream-50'
                    : 'text-cream-100/70 hover:bg-cream-100/5 hover:text-cream-50',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={clsx('size-1.5 rounded-full', isActive ? 'bg-gold-400' : 'bg-cream-100/0')}
                    aria-hidden
                  />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="mt-8 flex items-center gap-3 border-t border-cream-100/10 pt-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/20 font-mono text-sm text-gold-400">
          {employee?.avatarInitials ?? '—'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-cream-50">{employee?.name ?? 'Loading…'}</p>
          <p className="truncate text-xs text-cream-100/60">{employee?.designation ?? ''}</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded px-2 py-1.5 text-xs text-cream-100/60 hover:bg-cream-100/10 hover:text-cream-50"
          title="Sign out"
        >
          Exit
        </button>
      </div>
    </>
  )
}

export default function AppShell() {
  const employee = useAuthStore((s) => s.employee)
  const signOutLocally = useAuthStore((s) => s.signOutLocally)
  const [menuOpen, setMenuOpen] = useState(false)

  // While the mobile menu is open: lock page scroll behind it and let Escape close it.
  useEffect(() => {
    if (!menuOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      signOutLocally()
    }
  }

  return (
    <div className="min-h-screen bg-cream-100 lg:flex">
      {/* Desktop (≥1024px): fixed sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col justify-between overflow-y-auto bg-forest-800 px-5 py-6 text-cream-100 lg:flex">
        <SidebarContent onLogout={handleLogout} />
      </aside>

      {/* Phones and tablets (<1024px): top bar + slide-out menu */}
      <header className="sticky top-0 z-30 flex items-center gap-3 bg-forest-800 px-4 py-3 text-cream-100 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="-ml-2 flex size-10 items-center justify-center rounded-md hover:bg-cream-100/10"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="min-w-0 flex-1">
          <Brand />
        </div>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/20 font-mono text-sm text-gold-400">
          {employee?.avatarInitials ?? '—'}
        </span>
      </header>

      <div
        className={clsx(
          'fixed inset-0 z-40 bg-ink-900/50 transition-opacity lg:hidden',
          menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setMenuOpen(false)}
        aria-hidden
      />
      <aside
        id="mobile-nav"
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between overflow-y-auto bg-forest-800 px-5 py-6 text-cream-100 shadow-xl transition-transform duration-200 lg:hidden',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="absolute right-3 top-4 flex size-10 items-center justify-center rounded-md text-cream-100/70 hover:bg-cream-100/10 hover:text-cream-50"
          aria-label="Close menu"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <SidebarContent onLogout={handleLogout} onNavigate={() => setMenuOpen(false)} />
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 xl:px-12">
        <Outlet />
      </main>
    </div>
  )
}
