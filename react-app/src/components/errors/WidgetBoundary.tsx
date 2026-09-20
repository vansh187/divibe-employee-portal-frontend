import type { ReactNode } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { WidgetErrorFallback } from '@/components/errors/AppErrorFallback'

export function WidgetBoundary({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <ErrorBoundary FallbackComponent={() => <WidgetErrorFallback label={label} />}>
      {children}
    </ErrorBoundary>
  )
}
