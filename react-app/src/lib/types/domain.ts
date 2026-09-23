// Core domain types — mirrors V1.5 spec §10 (Core Data Model) and the
// Opportunity Engine field table (REQ-25). Kept framework-agnostic so the
// same shapes can be reused by the Vue app later.

export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ABSENT'
  | 'ON_SITE_VISIT'
  | 'WORK_FROM_HOME'
  | 'DAY_OFF'

export type DayOffStatus = 'OPEN' | 'SELECTED' | 'FROZEN' | 'COMPLETED'

export type LockStatus = 'ACTIVE' | 'EXPIRED' | 'RELEASED'

export type OpportunityStatus =
  | 'ACTIVE'
  | 'ATTRIBUTION_CONFLICT'
  | 'CONVERTED'
  | 'LOST'
  | 'EXPIRED'
  | 'RELEASED'

export type SourceOwnerType = 'EMPLOYEE' | 'CHANNEL_PARTNER'

export type PropertyAvailability = 'AVAILABLE' | 'LOCKED' | 'DEAL_LOCKED' | 'SOLD'

export type SiteVisitOutcome =
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'FOLLOW_UP_REQUIRED'
  | 'PROPOSAL_REQUESTED'
  | 'NO_SHOW'
  | 'OTHER'

export type ConflictCode = 'DAY_OFF_CONFLICT' | 'LEAD_LOCKED' | 'PROPERTY_LOCKED'

export interface Employee {
  id: string
  employeeCode?: string
  name: string
  email: string
  phone?: string
  designation?: string
  team?: string
  status: 'ACTIVE' | 'INACTIVE'
  avatarInitials: string
  weeklyDayOffAllowance?: number
  businessTimezone?: string
}

export interface Lead {
  id: string
  name: string
  normalizedPhone: string
  phone: string
  email?: string
  source: 'EMPLOYEE_SITE_VISIT' | 'CHANNEL_PARTNER'
  originatingEmployeeId: string
  currentEmployeeId?: string
  lifecycleStatus: 'NEW' | 'IN_PROGRESS' | 'CONVERTED' | 'LOST'
  firstVisitAt?: string
  latestVisitAt?: string
}

export interface Project {
  id: string
  name: string
  location: string
  phase?: string
}

export interface PropertyUnit {
  id: string
  projectId: string
  code: string // e.g. "Plot A-105"
  availability: PropertyAvailability
}

export interface SiteVisit {
  id: string
  employeeId: string
  leadId: string
  projectId: string
  propertyId?: string
  visitAt: string
  notes?: string
  attachments?: string[]
  outcome?: SiteVisitOutcome
  createdAt: string
}

export interface LeadLock {
  leadId: string
  employeeId: string
  siteVisitId: string
  lockedAt: string
  expiresAt: string
  status: LockStatus
}

export interface PropertyLock {
  propertyId: string
  employeeId: string
  siteVisitId: string
  leadLockId: string
  lockedAt: string
  expiresAt: string
  status: LockStatus
}

export interface FollowUpAction {
  id: string
  leadId: string
  employeeId: string
  actionType: 'CALL_LOGGED' | 'NEXT_VISIT_SCHEDULED' | 'PROPOSAL_SENT' | 'NOTE'
  loggedAt: string
  notes?: string
  reference?: string
}

export interface AttendanceRecord {
  id: string
  employeeId: string
  workDate: string
  checkInAt?: string
  checkOutAt?: string
  status: AttendanceStatus
  locationLabel?: string
}

export interface WeeklyDayOff {
  employeeId: string
  weekKey: string
  dayOffDate: string
  status: DayOffStatus
  selectedAt?: string
  frozenAt?: string
}

export interface Opportunity {
  id: string
  leadId: string
  projectId: string
  propertyId?: string
  sourceOwnerType: SourceOwnerType
  sourceOwnerId: string
  handlingEmployeeId?: string
  source: 'EMPLOYEE_SITE_VISIT' | 'CHANNEL_PARTNER'
  status: OpportunityStatus
  lockedAt?: string
  expiresAt?: string
  attributionStatus: 'VERIFIED' | 'CONFLICT' | 'RESOLVED'
}

export interface NotificationItem {
  id: string
  employeeId: string
  eventType: string
  entityType: string
  entityId: string
  message: string
  createdAt: string
  readAt?: string
}

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}

// Superset of mock-backend codes and the live API's documented error codes
// (see the Divine Vision API Integration Guide, §1). Kept as a plain string
// union rather than strict `ConflictCode` everywhere so new backend codes
// don't require a frontend type change to compile against.
export type ApiErrorCode =
  | ConflictCode
  | 'VALIDATION_ERROR'
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'DAY_OFF_ALLOWANCE_EXCEEDED'
  | 'DAY_OFF_VISIT_EXISTS'
  | 'OPPORTUNITY_NOT_ACTIVE'
  | 'DEAL_LOCKED'
  | 'ALREADY_CHECKED_IN'
  | 'ALREADY_CHECKED_OUT'
  | 'EMAIL_ALREADY_REGISTERED'
  | 'EMPLOYEE_ID_ALREADY_REGISTERED'
  | 'INVALID_OTP'
  | 'OTP_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVER_ERROR'
  | 'INTERNAL_ERROR'
  | (string & {})

export interface ApiErrorField {
  field: string
  message: string
}

export interface ApiErrorBody {
  code: ApiErrorCode
  message: string
  details?: Record<string, unknown>
  fields?: ApiErrorField[]
}
