import { apiFetch } from '@/lib/api/client'
import { liveFetch, liveFetchPaginated } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import type { NotificationItem, Paginated } from '@/lib/types/domain'

interface LiveNotificationRaw {
  id: string
  employee_id: string
  event_type: string
  entity_type: string
  entity_id: string
  message: string
  created_at: string
  read_at?: string
}

function adaptLiveNotification(raw: LiveNotificationRaw): NotificationItem {
  return {
    id: raw.id,
    employeeId: raw.employee_id,
    eventType: raw.event_type,
    entityType: raw.entity_type,
    entityId: raw.entity_id,
    message: raw.message,
    createdAt: raw.created_at,
    readAt: raw.read_at,
  }
}

export function fetchNotifications(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<NotificationItem>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20

  if (API_MODE === 'live') {
    return liveFetchPaginated<LiveNotificationRaw>(`/notifications?page=${page}&page_size=${pageSize}`).then((res) => ({
      ...res,
      items: res.items.map(adaptLiveNotification),
    }))
  }

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetch<Paginated<NotificationItem>>(`/notifications?${qs.toString()}`)
}

export function markNotificationRead(notificationId: string): Promise<void> {
  if (API_MODE === 'live') {
    return liveFetch<void>(`/notifications/${notificationId}/read`, { method: 'POST' })
  }
  return apiFetch<void>(`/notifications/${notificationId}/read`, { method: 'POST' })
}
