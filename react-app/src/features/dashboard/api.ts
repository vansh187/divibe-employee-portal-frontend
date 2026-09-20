import { apiFetch } from '@/lib/api/client'
import { liveFetch } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import { fetchSiteVisits } from '@/features/site-visits/api'
import type { AttendanceStatus, DayOffStatus } from '@/lib/types/domain'

export interface DashboardAttendanceSnapshot {
  checkInAt?: string
  checkOutAt?: string
  status: AttendanceStatus
}

export interface DashboardNextDayOff {
  dayOffDate: string
  status: DayOffStatus
}

export interface LockedLeadItem {
  leadLockId: string
  leadId: string
  leadName: string
  expiresAt: string
  propertyId?: string
  plotNo?: string
  projectName?: string
}

export interface RecentVisitItem {
  id: string
  visitAt: string
  outcome?: string
  leadName?: string
  projectName?: string
}

export interface DashboardData {
  employeeName?: string
  visitsToday: number
  activeLocks: number
  conversionsThisWeek: number
  todayAttendance: DashboardAttendanceSnapshot | null
  nextDayOff: DashboardNextDayOff | null
  lockedToYou: LockedLeadItem[]
  recentVisits: RecentVisitItem[]
}

// ---- mock (three separate endpoints, composed client-side) ----

interface MockSummary {
  visitsToday: number
  activeLocks: number
  conversionsThisWeek: number
  todayAttendance: DashboardAttendanceSnapshot | null
  nextDayOff: DashboardNextDayOff | null
}

interface MockActiveLockItem {
  lock: { leadId: string; expiresAt: string }
  lead?: { id: string; name: string }
  property?: { id: string; code: string }
  project?: { name: string }
}

async function fetchDashboardMock(): Promise<DashboardData> {
  const [summary, locks, visits] = await Promise.all([
    apiFetch<MockSummary>('/dashboard/summary'),
    apiFetch<MockActiveLockItem[]>('/locks/active'),
    fetchSiteVisits({ page: 1, pageSize: 5 }),
  ])

  return {
    ...summary,
    lockedToYou: locks.map((l) => ({
      leadLockId: l.lock.leadId,
      leadId: l.lock.leadId,
      leadName: l.lead?.name ?? 'Unknown lead',
      expiresAt: l.lock.expiresAt,
      propertyId: l.property?.id,
      plotNo: l.property?.code,
      projectName: l.project?.name,
    })),
    recentVisits: visits.items.map((v) => ({
      id: v.id,
      visitAt: v.visitAt,
      outcome: v.outcome,
      leadName: v.lead?.name,
      projectName: v.project?.name,
    })),
  }
}

// ---- live (single combined endpoint) ----

interface LiveDashboardRaw {
  employee_name: string
  visits_today_count: number
  active_locks_count: number
  conversions_this_week_count: number
  next_day_off: { day_off_date: string; status: DayOffStatus } | null
  today_attendance: { check_in_at?: string; check_out_at?: string; status: AttendanceStatus } | null
  locked_to_you: {
    lead_lock_id: string
    lead_id: string
    lead_name: string
    expires_at: string
    property_id?: string
    plot_no?: string
    project_name?: string
  }[]
  recent_visits: { id: string; visit_at: string; outcome?: string; lead_name?: string; project_name?: string }[]
}

async function fetchDashboardLive(): Promise<DashboardData> {
  const raw = await liveFetch<LiveDashboardRaw>('/dashboard')
  return {
    employeeName: raw.employee_name,
    visitsToday: raw.visits_today_count,
    activeLocks: raw.active_locks_count,
    conversionsThisWeek: raw.conversions_this_week_count,
    todayAttendance: raw.today_attendance
      ? { checkInAt: raw.today_attendance.check_in_at, checkOutAt: raw.today_attendance.check_out_at, status: raw.today_attendance.status }
      : null,
    nextDayOff: raw.next_day_off ? { dayOffDate: raw.next_day_off.day_off_date, status: raw.next_day_off.status } : null,
    lockedToYou: raw.locked_to_you.map((l) => ({
      leadLockId: l.lead_lock_id,
      leadId: l.lead_id,
      leadName: l.lead_name,
      expiresAt: l.expires_at,
      propertyId: l.property_id,
      plotNo: l.plot_no,
      projectName: l.project_name,
    })),
    recentVisits: raw.recent_visits.map((v) => ({
      id: v.id,
      visitAt: v.visit_at,
      outcome: v.outcome,
      leadName: v.lead_name,
      projectName: v.project_name,
    })),
  }
}

export function fetchDashboardData(): Promise<DashboardData> {
  return API_MODE === 'live' ? fetchDashboardLive() : fetchDashboardMock()
}
