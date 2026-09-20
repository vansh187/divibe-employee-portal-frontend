import type { HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx('rounded-xl border border-forest-800/10 bg-white p-5 shadow-sm', className)}
      {...props}
    />
  )
}

export function StatCard({
  label,
  value,
  suffix,
}: {
  label: string
  value: string | number
  suffix?: string
}) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</span>
      <span className="font-display text-3xl text-forest-800">
        {value}
        {suffix && <span className="ml-1 font-sans text-sm font-medium text-ink-500">{suffix}</span>}
      </span>
    </Card>
  )
}
