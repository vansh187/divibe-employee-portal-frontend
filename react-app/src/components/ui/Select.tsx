import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, id, className, children, ...props },
  ref,
) {
  const selectId = id ?? props.name
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'rounded-md border border-forest-800/15 bg-white px-3.5 py-2.5 text-sm text-ink-900',
          'focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500',
          error && 'border-status-danger focus:ring-status-danger/40',
          className,
        )}
        aria-invalid={!!error}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-status-danger">{error}</p>}
    </div>
  )
})
