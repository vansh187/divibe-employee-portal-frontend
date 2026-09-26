import { useQuery } from '@tanstack/react-query'
import { Card } from '@/components/ui/Card'
import { SkeletonBlock, InlineError } from '@/components/ui/States'
import { fetchVisitAnalytics } from '@/features/dashboard/visitAnalytics'
import type { BarDatum } from '@/features/dashboard/visitAnalytics'

function BarChart({ data, title }: { data: BarDatum[]; title: string }) {
  const max = Math.max(1, ...data.map((d) => d.count))
  const total = data.reduce((sum, d) => sum + d.count, 0)
  return (
    <div role="img" aria-label={`${title}: ${data.map((d) => `${d.label} ${d.count}`).join(', ')}`}>
      <div className="flex h-40 items-end gap-2">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-xs font-medium text-ink-700">{d.count > 0 ? d.count : ''}</span>
            <div
              className={`w-full rounded-t-md ${d.isCurrent ? 'bg-forest-800' : 'bg-forest-800/35'}`}
              style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 2 }}
              title={`${d.label}: ${d.count} visit${d.count === 1 ? '' : 's'}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-forest-800/10 pt-2">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="min-w-0 flex-1 text-center">
            <p className={`truncate text-xs ${d.isCurrent ? 'font-semibold text-ink-900' : 'text-ink-500'}`}>{d.label}</p>
            {d.sublabel && <p className="text-[10px] text-ink-500">{d.sublabel}</p>}
          </div>
        ))}
      </div>
      {total === 0 && <p className="mt-3 text-center text-xs text-ink-500">No visits in this period yet.</p>}
    </div>
  )
}

function Trend({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null
  const diff = current - previous
  const text = diff === 0 ? 'Same as last week' : `${diff > 0 ? '+' : ''}${diff} vs last week`
  return <span className={`text-xs ${diff < 0 ? 'text-status-danger' : 'text-status-success'}`}>{text}</span>
}

export function VisitCharts() {
  const { data, isLoading, error } = useQuery({ queryKey: ['site-visits', 'analytics'], queryFn: fetchVisitAnalytics })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>
    )
  }
  if (error || !data) return <InlineError message="Couldn't load your visit charts." />

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base text-ink-900">Visits this week</h2>
          <span className="flex items-baseline gap-2 text-sm text-ink-700">
            <span className="font-semibold">{data.thisWeekTotal}</span> total
            <Trend current={data.thisWeekTotal} previous={data.lastWeekTotal} />
          </span>
        </div>
        <BarChart data={data.thisWeekDaily} title="Visits per day this week" />
      </Card>

      <Card>
        <div className="mb-4 flex items-baseline justify-between gap-2">
          <h2 className="font-display text-base text-ink-900">Weekly trend</h2>
          <span className="text-sm text-ink-700">
            <span className="font-semibold">{data.eightWeekTotal}</span> in last 8 weeks
          </span>
        </div>
        <BarChart data={data.weekly} title="Visits per week, week starting" />
        <p className="mt-1 text-center text-[10px] text-ink-500">Week starting (Monday)</p>
      </Card>
    </div>
  )
}
