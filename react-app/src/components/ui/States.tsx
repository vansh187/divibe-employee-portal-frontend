import type { ReactNode } from 'react'

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[240px] w-full flex-col items-center justify-center gap-3 text-ink-500">
      <span className="size-6 animate-spin rounded-full border-2 border-forest-800/30 border-t-forest-800" aria-hidden />
      <p className="text-sm">{label}</p>
    </div>
  )
}

export function SkeletonBlock({ className = 'h-24' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-forest-800/8 ${className}`} />
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-forest-800/20 px-6 py-12 text-center">
      <p className="font-display text-lg text-forest-800">{title}</p>
      {description && <p className="max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function InlineError({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-status-danger/30 bg-status-danger-bg px-4 py-3 text-sm text-status-danger">
      {message}
    </div>
  )
}
