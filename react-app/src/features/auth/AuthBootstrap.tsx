import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/features/auth/store'
import { restoreSession } from '@/features/auth/api'
import { PageLoading } from '@/components/ui/States'

/**
 * Runs once on app mount: attempts to silently restore the session from the
 * persisted refresh token (behind a full-page loader) before the router
 * renders anything. This is what makes reloading a deep authenticated link
 * (e.g. /leads/42) land back on that exact page instead of bouncing through
 * the dashboard or a 404 — the browser router already points at the right
 * URL, we just need to resolve auth state before rendering it.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage)
  const confirmRestored = useAuthStore((s) => s.confirmRestored)
  const signOutLocally = useAuthStore((s) => s.signOutLocally)
  const ranOnce = useRef(false)

  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true

    const persisted = hydrateFromStorage()
    if (!persisted) return

    restoreSession().then((employee) => {
      if (employee) confirmRestored(employee)
      else signOutLocally()
    })
  }, [hydrateFromStorage, confirmRestored, signOutLocally])

  if (status === 'idle' || status === 'restoring') {
    return <PageLoading label="Restoring your session…" />
  }

  return <>{children}</>
}
