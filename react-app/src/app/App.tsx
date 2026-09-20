import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import { queryClient } from '@/lib/queryClient'
import { router } from '@/app/router'
import { AuthBootstrap } from '@/features/auth/AuthBootstrap'
import { GlobalErrorFallback } from '@/components/errors/AppErrorFallback'

export default function App() {
  return (
    <ErrorBoundary FallbackComponent={GlobalErrorFallback}>
      <QueryClientProvider client={queryClient}>
        <AuthBootstrap>
          <RouterProvider router={router} />
        </AuthBootstrap>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}
