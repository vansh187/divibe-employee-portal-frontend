import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAttendance, fetchTodayAttendance, checkIn, checkOut } from '@/features/attendance/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonBlock, EmptyState, InlineError } from '@/components/ui/States'
import { formatDateLong, formatTime } from '@/lib/format'
import { ATTENDANCE_STATUS_LABEL } from '@/lib/constants'
import { ApiError } from '@/lib/api/client'
import type { AttendanceStatus } from '@/lib/types/domain'

const STATUS_TONE: Record<AttendanceStatus, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  PRESENT: 'success',
  LATE: 'warning',
  HALF_DAY: 'warning',
  ABSENT: 'danger',
  ON_SITE_VISIT: 'info',
  WORK_FROM_HOME: 'info',
  DAY_OFF: 'neutral',
}

function CheckInOutCard() {
  const queryClient = useQueryClient()
  const { data: todayRecord, isLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: fetchTodayAttendance,
  })

  const invalidateAttendance = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const checkInMutation = useMutation({ mutationFn: checkIn, onSuccess: invalidateAttendance })
  const checkOutMutation = useMutation({ mutationFn: checkOut, onSuccess: invalidateAttendance })

  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Today</p>
        {isLoading ? (
          <SkeletonBlock className="mt-2 h-6 w-40" />
        ) : todayRecord?.checkInAt ? (
          <p className="mt-1 text-sm text-ink-900">
            Checked in at <span className="font-semibold">{formatTime(todayRecord.checkInAt)}</span>
            {todayRecord.checkOutAt && (
              <>
                {' '}
                · Checked out at <span className="font-semibold">{formatTime(todayRecord.checkOutAt)}</span>
              </>
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-500">You haven't checked in yet.</p>
        )}
        {(checkInMutation.isError || checkOutMutation.isError) && (
          <p className="mt-1 text-xs text-status-danger">
            {(checkInMutation.error ?? checkOutMutation.error) instanceof ApiError
              ? (checkInMutation.error ?? checkOutMutation.error)?.message
              : 'Something went wrong.'}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          disabled={!!todayRecord?.checkInAt}
          isLoading={checkInMutation.isPending}
          onClick={() => checkInMutation.mutate()}
        >
          Check In
        </Button>
        <Button
          disabled={!todayRecord?.checkInAt || !!todayRecord?.checkOutAt}
          isLoading={checkOutMutation.isPending}
          onClick={() => checkOutMutation.mutate()}
        >
          Check Out
        </Button>
      </div>
    </Card>
  )
}

export default function AttendancePage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance', { page, pageSize: 10 }],
    queryFn: () => fetchAttendance({ page, pageSize: 10 }),
  })

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Server timestamps are authoritative for check-in and check-out." />

      <div className="mb-6">
        <CheckInOutCard />
      </div>

      <Card>
        <h2 className="mb-4 font-display text-base text-ink-900">History</h2>

        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-12" />
            ))}
          </div>
        )}

        {error && <InlineError message={error instanceof ApiError ? error.message : 'Failed to load attendance.'} />}

        {!isLoading && data && data.items.length === 0 && <EmptyState title="No attendance records yet." />}

        {!isLoading && data && data.items.length > 0 && (
          <ul className="flex flex-col divide-y divide-forest-800/8">
            {data.items.map((rec) => (
              <li key={rec.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{formatDateLong(rec.workDate)}</p>
                  <p className="text-xs text-ink-500">
                    {rec.checkInAt ? formatTime(rec.checkInAt) : '—'}
                    {rec.checkOutAt ? ` – ${formatTime(rec.checkOutAt)}` : ''}
                  </p>
                </div>
                <Badge tone={STATUS_TONE[rec.status]}>{ATTENDANCE_STATUS_LABEL[rec.status]}</Badge>
              </li>
            ))}
          </ul>
        )}

        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  )
}
