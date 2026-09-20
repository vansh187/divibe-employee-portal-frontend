import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuthStore } from '@/features/auth/store'
import { REDIRECT_QUERY_PARAM } from '@/lib/constants'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status !== 'authenticated') {
    const redirectPath = `${location.pathname}${location.search}`
    return <Navigate to={`/login?${REDIRECT_QUERY_PARAM}=${encodeURIComponent(redirectPath)}`} replace />
  }

  return <>{children}</>
}
