import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { fetchDashboardData } from '@/features/dashboard/api'
import { useAuthStore } from '@/features/auth/store'
import { StatCard, Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { VisitCharts } from '@/features/dashboard/VisitCharts'
import { WidgetBoundary } from '@/components/errors/WidgetBoundary'
import { SkeletonBlock, EmptyState, InlineError } from '@/components/ui/States'
import { formatRemaining, formatTime, formatDate, formatDateLong, isToday } from '@/lib/format'
import { DAY_OFF_STATUS_LABEL } from '@/lib/constants'
import { ApiError } from '@/lib/api/client'
import type { DashboardData } from '@/features/dashboard/api'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function ms(expiresAt: string): number {
  return new Date(expiresAt).getTime() - Date.now()
}

function StatsRow({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      <StatCard label="Visits Today" value={data.visitsToday} />
      <StatCard label="Active Locks" value={data.activeLocks} />
      <StatCard label="Conversions · Week" value={data.conversionsThisWeek} />
      <StatCard
        label="Next Day Off"
        value={data.nextDayOff ? formatDateLong(data.nextDayOff.dayOffDate).split(',')[0] : '—'}
        suffix={data.nextDayOff ? DAY_OFF_STATUS_LABEL[data.nextDayOff.status] : undefined}
      />
    </div>
  )
}

function LockedToYouPanel({ data }: { data: DashboardData }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-base text-ink-900">Locked to you</h2>
        <span className="text-xs text-ink-500">Auto-releases after 3 days of inaction</span>
      </div>

      {data.lockedToYou.length === 0 && (
        <EmptyState title="No active locks" description="Log a site visit to protect a lead and property for 3 days." />
      )}

      {data.lockedToYou.length > 0 && (
        <ul className="flex flex-col divide-y divide-forest-800/8">
          {data.lockedToYou.map((item) => (
            <li key={item.leadLockId} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-forest-800/8 font-mono text-xs text-forest-800">
                {item.projectName?.slice(0, 2).toUpperCase() ?? '—'}
              </span>
              <div className="min-w-0 flex-1">
                <Link to={`/leads/${item.leadId}`} className="truncate text-sm font-semibold text-ink-900 hover:underline">
                  {item.leadName} {item.plotNo ? `· Plot ${item.plotNo}` : ''}
                </Link>
                <p className="truncate text-xs text-ink-500">{item.projectName}</p>
              </div>
              <Badge tone={ms(item.expiresAt) < 6 * 3_600_000 ? 'danger' : 'warning'}>{formatRemaining(item.expiresAt)}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function RecentVisitsPanel({ data }: { data: DashboardData }) {
  return (
    <Card>
      <h2 className="mb-4 font-display text-base text-ink-900">Recent visits</h2>
      {data.recentVisits.length === 0 && <EmptyState title="No visits yet" description="Your logged site visits will appear here." />}
      {data.recentVisits.length > 0 && (
        <ul className="flex flex-col divide-y divide-forest-800/8">
          {data.recentVisits.map((v) => (
            <li key={v.id} className="flex items-start gap-3 py-3">
              <span className="mt-0.5 w-16 shrink-0 text-xs text-ink-500">{formatTime(v.visitAt)}
                {!isToday(v.visitAt) && <span className="block whitespace-nowrap">{formatDate(v.visitAt)}</span>}
              </span>
              <div className="min-w-0 flex-1 border-l-2 border-gold-400 pl-3">
                <p className="text-sm font-semibold text-ink-900">Site walk · {v.projectName ?? '—'}</p>
                <p className="text-xs text-ink-500">Prospect: {v.leadName ?? '—'}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export default function DashboardPage() {
  const employee = useAuthStore((s) => s.employee)
  const firstName = employee?.name?.split(' ')[0] ?? ''
  const today = new Date()

  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: fetchDashboardData })

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-ink-900">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-ink-500">{formatDateLong(today.toISOString())}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/attendance">
            <Button variant="secondary" size="sm">
              View Attendance
            </Button>
          </Link>
          <Link to="/site-visits/new">
            <Button size="sm">+ Log Visit</Button>
          </Link>
        </div>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-24" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <SkeletonBlock className="h-56" />
            <SkeletonBlock className="h-56" />
          </div>
        </div>
      )}

      {error && <InlineError message={error instanceof ApiError ? error.message : 'Failed to load your dashboard.'} />}

      {!isLoading && data && (
        <div className="flex flex-col gap-6">
          <WidgetBoundary label="Summary stats">
            <StatsRow data={data} />
          </WidgetBoundary>

          <WidgetBoundary label="Visit charts">
            <VisitCharts />
          </WidgetBoundary>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <WidgetBoundary label="Locked leads">
              <LockedToYouPanel data={data} />
            </WidgetBoundary>
            <WidgetBoundary label="Recent visits">
              <RecentVisitsPanel data={data} />
            </WidgetBoundary>
          </div>
        </div>
      )}
    </div>
  )
}
