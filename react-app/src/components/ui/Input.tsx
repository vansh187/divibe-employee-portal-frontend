import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { clsx } from 'clsx'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className, ...props },
  ref,
) {
  const inputId = id ?? props.name
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          // 16px on phones: iOS Safari zooms the page when focusing a smaller input.
          'w-full min-w-0 rounded-md border border-forest-800/15 bg-white px-3.5 py-2.5 text-base text-ink-900 sm:text-sm',
          'placeholder:text-ink-500/60',
          'focus:outline-none focus:ring-2 focus:ring-gold-500/60 focus:border-gold-500',
          error && 'border-status-danger focus:ring-status-danger/40',
          className,
        )}
        aria-invalid={!!error}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={inputId ? `${inputId}-error` : undefined} className="text-xs text-status-danger">
          {error}
        </p>
      )}
    </div>
  )
})
