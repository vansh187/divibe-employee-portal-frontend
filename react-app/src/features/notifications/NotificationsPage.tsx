import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchNotifications, markNotificationRead } from '@/features/notifications/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonBlock, EmptyState, InlineError } from '@/components/ui/States'
import { formatDateTime } from '@/lib/format'
import { ApiError } from '@/lib/api/client'

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications', { page }],
    queryFn: () => fetchNotifications({ page, pageSize: 15 }),
  })

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Activity history for your leads, locks and Day Off." />

      <Card>
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-12" />
            ))}
          </div>
        )}

        {error && <InlineError message={error instanceof ApiError ? error.message : 'Failed to load notifications.'} />}

        {!isLoading && data && data.items.length === 0 && <EmptyState title="You're all caught up." />}

        {!isLoading && data && data.items.length > 0 && (
          <ul className="flex flex-col divide-y divide-forest-800/8">
            {data.items.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className={`text-sm ${n.readAt ? 'text-ink-500' : 'font-medium text-ink-900'}`}>{n.message}</p>
                  <p className="text-xs text-ink-500">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.readAt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    isLoading={markReadMutation.isPending && markReadMutation.variables === n.id}
                    onClick={() => markReadMutation.mutate(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  )
}
