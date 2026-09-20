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

export default function AppShell() {
  const employee = useAuthStore((s) => s.employee)
  const signOutLocally = useAuthStore((s) => s.signOutLocally)

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      signOutLocally()
    }
  }

  return (
    <div className="flex min-h-screen bg-cream-100">
      <aside className="flex w-60 shrink-0 flex-col justify-between bg-forest-800 px-5 py-6 text-cream-100">
        <div>
          <div className="px-1">
            <p className="font-display text-sm font-semibold tracking-wide text-gold-400">DIVINE VISION</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-cream-100/60">Field Portal</p>
          </div>

          <nav className="mt-8 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-cream-100/10 font-semibold text-cream-50'
                      : 'text-cream-100/70 hover:bg-cream-100/5 hover:text-cream-50',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={clsx(
                        'size-1.5 rounded-full',
                        isActive ? 'bg-gold-400' : 'bg-cream-100/0',
                      )}
                      aria-hidden
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3 border-t border-cream-100/10 pt-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/20 font-mono text-sm text-gold-400">
            {employee?.avatarInitials ?? '—'}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-cream-50">{employee?.name ?? 'Loading…'}</p>
            <p className="truncate text-xs text-cream-100/60">{employee?.designation ?? ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded p-1.5 text-xs text-cream-100/60 hover:bg-cream-100/10 hover:text-cream-50"
            title="Sign out"
          >
            Exit
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-8 py-8 md:px-12">
        <Outlet />
      </main>
    </div>
  )
}
