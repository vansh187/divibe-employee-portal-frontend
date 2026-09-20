import { apiFetch } from '@/lib/api/client'
import { liveFetch, liveFetchPaginated } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import type { AttendanceRecord, Paginated } from '@/lib/types/domain'

// Field names assumed consistent with the rest of the guide (snake_case ids/dates) —
// the guide doesn't show an example attendance record JSON. Confirm once live.
interface LiveAttendanceRaw {
  id: string
  employee_id: string
  work_date: string
  check_in_at?: string
  check_out_at?: string
  status: AttendanceRecord['status']
  location_label?: string
}

function adaptLiveAttendance(raw: LiveAttendanceRaw): AttendanceRecord {
  return {
    id: raw.id,
    employeeId: raw.employee_id,
    workDate: raw.work_date,
    checkInAt: raw.check_in_at,
    checkOutAt: raw.check_out_at,
    status: raw.status,
    locationLabel: raw.location_label,
  }
}

export function fetchAttendance(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<AttendanceRecord>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 15

  if (API_MODE === 'live') {
    return liveFetchPaginated<LiveAttendanceRaw>(`/attendance/history?page=${page}&page_size=${pageSize}`).then((res) => ({
      ...res,
      items: res.items.map(adaptLiveAttendance),
    }))
  }

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetch<Paginated<AttendanceRecord>>(`/attendance?${qs.toString()}`)
}

/** Today's attendance record, or null if not checked in yet. */
export function fetchTodayAttendance(): Promise<AttendanceRecord | null> {
  if (API_MODE === 'live') {
    return liveFetch<LiveAttendanceRaw | null>('/attendance/today').then((raw) => (raw ? adaptLiveAttendance(raw) : null))
  }
  return apiFetch<Paginated<AttendanceRecord>>('/attendance?page=1&pageSize=1').then((res) => {
    const today = res.items[0]
    return today && today.workDate === new Date().toISOString().slice(0, 10) ? today : null
  })
}

function getGeolocation(): Promise<{ latitude: number; longitude: number } | undefined> {
  if (!navigator.geolocation) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(undefined), // permission denied / unavailable — check in without location
      { timeout: 4000 },
    )
  })
}

export async function checkIn(): Promise<AttendanceRecord> {
  if (API_MODE === 'live') {
    const location = await getGeolocation()
    const raw = await liveFetch<LiveAttendanceRaw>('/attendance/check-in', {
      method: 'POST',
      body: location ? { latitude: location.latitude, longitude: location.longitude } : {},
    })
    return adaptLiveAttendance(raw)
  }
  return apiFetch<AttendanceRecord>('/attendance/check-in', { method: 'POST' })
}

export function checkOut(): Promise<AttendanceRecord> {
  if (API_MODE === 'live') {
    return liveFetch<LiveAttendanceRaw>('/attendance/check-out', { method: 'POST' }).then(adaptLiveAttendance)
  }
  return apiFetch<AttendanceRecord>('/attendance/check-out', { method: 'POST' })
}
