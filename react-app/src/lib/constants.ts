import type { AttendanceStatus, DayOffStatus, PropertyAvailability } from '@/lib/types/domain'

export const LOCK_WINDOW_DAYS = 3

export const CONFLICT_MESSAGES: Record<string, string> = {
  DAY_OFF_CONFLICT: 'This date is your frozen Day Off. Site visits cannot be logged on a Day Off.',
  LEAD_LOCKED: 'This lead is currently locked to another employee. It will release automatically if no qualifying action is taken.',
  PROPERTY_LOCKED: 'This plot/property is currently locked to another employee for this lead.',
  OPPORTUNITY_CONFLICT: 'This customer and plot were just claimed by someone else.',
  CONCURRENT_UPDATE: 'Please try again.',
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  LATE: 'Late',
  HALF_DAY: 'Half-Day',
  ABSENT: 'Absent',
  ON_SITE_VISIT: 'On-Site Visit',
  WORK_FROM_HOME: 'Work From Home',
  DAY_OFF: 'Day Off',
}

export const DAY_OFF_STATUS_LABEL: Record<DayOffStatus, string> = {
  OPEN: 'Open',
  SELECTED: 'Selected — awaiting freeze',
  FROZEN: 'Frozen',
  COMPLETED: 'Completed',
}

export const PROPERTY_AVAILABILITY_LABEL: Record<PropertyAvailability, string> = {
  AVAILABLE: 'Available',
  LOCKED: 'Locked',
  DEAL_LOCKED: 'Deal Locked',
  SOLD: 'Sold',
}

export const AUTH_STORAGE_KEY = 'dvi.auth.v1'
export const REDIRECT_QUERY_PARAM = 'redirect'
