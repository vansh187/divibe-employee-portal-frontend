import { apiFetch } from '@/lib/api/client'
import { liveFetch } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import { weekKeyFor } from '@/lib/week'
import type { WeeklyDayOff } from '@/lib/types/domain'

// Field names assumed consistent with the rest of the guide — confirm once live.
interface LiveDayOffRaw {
  day_off_date: string
  status: WeeklyDayOff['status']
  selected_at?: string
  frozen_at?: string
}

function adaptLiveDayOff(raw: LiveDayOffRaw): WeeklyDayOff {
  return {
    employeeId: '',
    weekKey: weekKeyFor(raw.day_off_date),
    dayOffDate: raw.day_off_date,
    status: raw.status,
    selectedAt: raw.selected_at,
    frozenAt: raw.frozen_at,
  }
}

async function fetchDayOffCalendarLive(): Promise<WeeklyDayOff[]> {
  const [current, history] = await Promise.all([
    liveFetch<LiveDayOffRaw | null>('/day-off/current-week'),
    liveFetch<LiveDayOffRaw[]>('/day-off/history?page=1&page_size=52').catch(() => [] as LiveDayOffRaw[]),
  ])
  const records = history.map(adaptLiveDayOff)
  if (current) records.unshift(adaptLiveDayOff(current))
  return records
}

async function fetchDayOffCalendarMock(): Promise<WeeklyDayOff[]> {
  return apiFetch<WeeklyDayOff[]>('/day-off/calendar')
}

export function fetchDayOffCalendar(): Promise<WeeklyDayOff[]> {
  return API_MODE === 'live' ? fetchDayOffCalendarLive() : fetchDayOffCalendarMock()
}

/**
 * Live mode: this freezes the date immediately (there's no separate freeze
 * step in the real API — see DayOffCalendarPage, which shows a confirm
 * dialog before calling this in live mode instead of a two-step select→freeze UI).
 */
export function selectDayOff(date: string): Promise<WeeklyDayOff> {
  if (API_MODE === 'live') {
    return liveFetch<LiveDayOffRaw>('/day-off/select', { method: 'POST', body: { day_off_date: date } }).then(adaptLiveDayOff)
  }
  return apiFetch<WeeklyDayOff>('/day-off/select', { method: 'POST', body: { date } })
}

/** Mock-only — the live API has no separate freeze step (select freezes immediately). */
export function freezeDayOff(weekKey: string): Promise<WeeklyDayOff> {
  return apiFetch<WeeklyDayOff>('/day-off/freeze', { method: 'POST', body: { weekKey } })
}
