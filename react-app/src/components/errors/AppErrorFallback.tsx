import { useRouteError, isRouteErrorResponse, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

function Shell({ title, message, showHome }: { title: string; message: string; showHome?: boolean }) {
  const navigate = useNavigate()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream-100 px-6 text-center">
      <p className="font-display text-2xl text-forest-800">{title}</p>
      <p className="max-w-md text-sm text-ink-500">{message}</p>
      <div className="mt-2 flex gap-3">
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        {showHome && (
          <Button
            onClick={() => {
              navigate('/dashboard')
            }}
          >
            Go to Dashboard
          </Button>
        )}
      </div>
    </div>
  )
}

/** Used as a route's `errorElement` — catches loader/action errors and unhandled render errors for that route. */
export function RouteErrorBoundary() {
  const error = useRouteError()

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <Shell
          title="Page not found"
          message="The page you're looking for doesn't exist or may have moved."
          showHome
        />
      )
    }
    return (
      <Shell
        title={`Something went wrong (${error.status})`}
        message={error.statusText || 'Please try again.'}
        showHome
      />
    )
  }

  return (
    <Shell
      title="Something went wrong"
      message="This page ran into an unexpected error. Reloading usually fixes it — your data is safe."
      showHome
    />
  )
}

/** Used with react-error-boundary for render errors caught outside the router's error handling. */
export function GlobalErrorFallback() {
  return (
    <Shell
      title="Something went wrong"
      message="The app ran into an unexpected error. Reloading usually fixes it."
    />
  )
}

export function WidgetErrorFallback({ label = 'This section' }: { label?: string }) {
  return (
    <div className="rounded-xl border border-status-danger/20 bg-status-danger-bg/40 p-4 text-sm text-status-danger">
      {label} couldn't load. Try refreshing the page.
    </div>
  )
}
