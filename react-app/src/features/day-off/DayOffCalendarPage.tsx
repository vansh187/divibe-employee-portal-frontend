import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDayOffCalendar, selectDayOff, freezeDayOff } from '@/features/day-off/api'
import { API_MODE } from '@/lib/apiMode'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { PageLoading, InlineError, EmptyState } from '@/components/ui/States'
import { formatDateLong } from '@/lib/format'
import { currentWeekDates, weekKeyFor } from '@/lib/week'
import { DAY_OFF_STATUS_LABEL } from '@/lib/constants'
import { ApiError } from '@/lib/api/client'
import type { DayOffStatus } from '@/lib/types/domain'

const STATUS_TONE: Record<DayOffStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  OPEN: 'neutral',
  SELECTED: 'warning',
  FROZEN: 'success',
  COMPLETED: 'neutral',
}

export default function DayOffCalendarPage() {
  const queryClient = useQueryClient()
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({ queryKey: ['day-off'], queryFn: fetchDayOffCalendar })

  const thisWeekKey = weekKeyFor(new Date().toISOString())
  const thisWeekRecord = data?.find((d) => d.weekKey === thisWeekKey)
  const weekDates = currentWeekDates()
  const todayStr = new Date().toISOString().slice(0, 10)

  const selectMutation = useMutation({
    mutationFn: (date: string) => selectDayOff(date),
    onSuccess: () => {
      setFormError(null)
      queryClient.invalidateQueries({ queryKey: ['day-off'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Unable to select this date.'),
  })

  const freezeMutation = useMutation({
    mutationFn: () => freezeDayOff(thisWeekKey),
    onSuccess: () => {
      setFormError(null)
      queryClient.invalidateQueries({ queryKey: ['day-off'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (err) => setFormError(err instanceof ApiError ? err.message : 'Unable to freeze this Day Off.'),
  })

  if (isLoading) return <PageLoading label="Loading your Day Off calendar…" />
  if (error) return <InlineError message={error instanceof ApiError ? error.message : 'Failed to load Day Off calendar.'} />

  const isFrozen = thisWeekRecord?.status === 'FROZEN'
  const history = (data ?? []).filter((d) => d.weekKey !== thisWeekKey)

  return (
    <div className="max-w-2xl">
      <PageHeader title="Weekly Day Off" subtitle="Select and freeze one Day Off per week. A frozen Day Off blocks site visits for that date." />

      <Card className="mb-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base text-ink-900">This week</h2>
          {thisWeekRecord && <Badge tone={STATUS_TONE[thisWeekRecord.status]}>{DAY_OFF_STATUS_LABEL[thisWeekRecord.status]}</Badge>}
        </div>

        {formError && (
          <div className="mb-4">
            <InlineError message={formError} />
          </div>
        )}

        {isFrozen ? (
          <p className="text-sm text-ink-700">
            Your Day Off is frozen for <span className="font-semibold">{formatDateLong(thisWeekRecord!.dayOffDate)}</span>. This
            date will show as Day Off in Attendance and site visits cannot be logged for it.
          </p>
        ) : (
          <>
            <p className="mb-3 text-sm text-ink-500">
              {API_MODE === 'live'
                ? 'Choose an eligible date this week — selecting freezes it immediately and cannot be undone here.'
                : 'Choose an eligible date this week:'}
            </p>
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {weekDates.map((date) => {
                const isPast = date < todayStr
                const isSelected = thisWeekRecord?.dayOffDate === date
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={isPast || selectMutation.isPending}
                    onClick={() => {
                      if (API_MODE === 'live') {
                        const confirmed = window.confirm(
                          `Freeze ${formatDateLong(date)} as your Day Off for this week? This can't be undone from here.`,
                        )
                        if (!confirmed) return
                      }
                      setPendingDate(date)
                      selectMutation.mutate(date)
                    }}
                    className={`rounded-md border px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isSelected
                        ? 'border-gold-500 bg-gold-500/10 font-semibold text-forest-800'
                        : 'border-forest-800/15 text-ink-700 hover:bg-forest-800/5'
                    }`}
                  >
                    {formatDateLong(date).split(',')[0]}
                    <span className="block text-xs text-ink-500">{formatDateLong(date).split(', ')[1]}</span>
                  </button>
                )
              })}
            </div>
            {thisWeekRecord?.status === 'SELECTED' && (
              <Button isLoading={freezeMutation.isPending} onClick={() => freezeMutation.mutate()}>
                Confirm &amp; Freeze {formatDateLong(thisWeekRecord.dayOffDate).split(',')[0]}
              </Button>
            )}
            {selectMutation.isPending && !thisWeekRecord && (
              <p className="text-xs text-ink-500">Checking {pendingDate}…</p>
            )}
          </>
        )}
      </Card>

      <Card>
        <h2 className="mb-4 font-display text-base text-ink-900">History</h2>
        {history.length === 0 ? (
          <EmptyState title="No past Day Off records yet." />
        ) : (
          <ul className="flex flex-col divide-y divide-forest-800/8">
            {history.map((d) => (
              <li key={d.weekKey} className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-900">{formatDateLong(d.dayOffDate)}</span>
                <Badge tone={STATUS_TONE[d.status]}>{DAY_OFF_STATUS_LABEL[d.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
