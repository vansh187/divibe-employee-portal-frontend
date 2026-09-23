import type {
  AttendanceRecord,
  Employee,
  FollowUpAction,
  Lead,
  LeadLock,
  NotificationItem,
  Opportunity,
  Project,
  PropertyLock,
  PropertyUnit,
  SiteVisit,
  WeeklyDayOff,
} from '@/lib/types/domain'
import { weekKeyFor } from '@/lib/week'

export const CURRENT_EMPLOYEE_ID = 'E-101'

// Mock-only: the domain `Employee` type has no password field since the live API
// never returns one. Signed-up mock accounts carry one here so login can check it.
export interface MockEmployee extends Employee {
  password?: string
}

// Mock-only: an employee who submitted the signup form but hasn't verified their
// email OTP yet. Promoted to a real `MockEmployee` on successful verification.
export interface PendingSignup {
  email: string
  name: string
  employeeCode: string
  password: string
  otp: string
  otpExpiresAt: string
  createdAt: string
}

export interface MockDb {
  employees: MockEmployee[]
  pendingSignups: PendingSignup[]
  projects: Project[]
  properties: PropertyUnit[]
  leads: Lead[]
  siteVisits: SiteVisit[]
  leadLocks: LeadLock[]
  propertyLocks: PropertyLock[]
  followUps: FollowUpAction[]
  attendance: AttendanceRecord[]
  dayOffs: WeeklyDayOff[]
  opportunities: Opportunity[]
  notifications: NotificationItem[]
}

function iso(daysFromNow: number, hour = 10, minute = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

export function buildSeed(): MockDb {
  const employees: MockEmployee[] = [
    {
      id: CURRENT_EMPLOYEE_ID,
      employeeCode: 'DVI-101',
      name: 'Rohan Kaushik',
      email: 'rohan.kaushik@divinevisioninfra.com',
      designation: 'Site Executive',
      team: 'Field Sales',
      status: 'ACTIVE',
      avatarInitials: 'RK',
      // Seeded demo accounts accept any non-empty password (see mock login handler)
      // so this is only set for documentation; signup-created accounts set a real one.
      password: 'password123',
    },
    {
      id: 'E-102',
      employeeCode: 'DVI-102',
      name: 'Ananya Verma',
      email: 'ananya.verma@divinevisioninfra.com',
      designation: 'Site Executive',
      team: 'Field Sales',
      status: 'ACTIVE',
      avatarInitials: 'AV',
      password: 'password123',
    },
  ]

  const projects: Project[] = [
    { id: 'PRJ-1', name: 'OPS Divine Greens', location: 'Karnal', phase: 'Phase 1' },
    { id: 'PRJ-2', name: 'Suraksha Enclave', location: 'Ganaur', phase: 'Phase 2' },
    { id: 'PRJ-3', name: 'Divine Kurukshetra Heights', location: 'Kurukshetra', phase: 'Phase 1' },
  ]

  const properties: PropertyUnit[] = [
    { id: 'PLOT-B114', projectId: 'PRJ-1', code: 'Plot B-114', availability: 'LOCKED' },
    { id: 'PLOT-C208', projectId: 'PRJ-1', code: 'Plot C-208', availability: 'LOCKED' },
    { id: 'PLOT-A105', projectId: 'PRJ-1', code: 'Plot A-105', availability: 'AVAILABLE' },
    { id: 'PLOT-42', projectId: 'PRJ-2', code: 'Plot 42', availability: 'LOCKED' },
    { id: 'PLOT-17', projectId: 'PRJ-2', code: 'Plot 17', availability: 'AVAILABLE' },
    { id: 'PLOT-K09', projectId: 'PRJ-3', code: 'Plot K-09', availability: 'SOLD' },
    { id: 'PLOT-K10', projectId: 'PRJ-3', code: 'Plot K-10', availability: 'AVAILABLE' },
  ]

  const leads: Lead[] = [
    {
      id: 'LEAD-1',
      name: 'Ankit Malhotra',
      normalizedPhone: '919810011111',
      phone: '+91 98100 11111',
      email: 'ankit.malhotra@example.com',
      source: 'EMPLOYEE_SITE_VISIT',
      originatingEmployeeId: CURRENT_EMPLOYEE_ID,
      currentEmployeeId: CURRENT_EMPLOYEE_ID,
      lifecycleStatus: 'IN_PROGRESS',
      firstVisitAt: iso(-3),
      latestVisitAt: iso(-3),
    },
    {
      id: 'LEAD-2',
      name: 'Neha & Sameer Kapoor',
      normalizedPhone: '919810022222',
      phone: '+91 98100 22222',
      source: 'EMPLOYEE_SITE_VISIT',
      originatingEmployeeId: CURRENT_EMPLOYEE_ID,
      currentEmployeeId: CURRENT_EMPLOYEE_ID,
      lifecycleStatus: 'IN_PROGRESS',
      firstVisitAt: iso(-2),
      latestVisitAt: iso(-2),
    },
    {
      id: 'LEAD-3',
      name: 'Priya Sehgal',
      normalizedPhone: '919810033333',
      phone: '+91 98100 33333',
      source: 'EMPLOYEE_SITE_VISIT',
      originatingEmployeeId: CURRENT_EMPLOYEE_ID,
      currentEmployeeId: CURRENT_EMPLOYEE_ID,
      lifecycleStatus: 'IN_PROGRESS',
      firstVisitAt: iso(-5),
      latestVisitAt: iso(-1),
    },
    {
      id: 'LEAD-4',
      name: 'Vikram Oberoi',
      normalizedPhone: '919810044444',
      phone: '+91 98100 44444',
      source: 'EMPLOYEE_SITE_VISIT',
      originatingEmployeeId: CURRENT_EMPLOYEE_ID,
      currentEmployeeId: CURRENT_EMPLOYEE_ID,
      lifecycleStatus: 'NEW',
    },
    {
      id: 'LEAD-5',
      name: 'Farah Qureshi',
      normalizedPhone: '919810055555',
      phone: '+91 98100 55555',
      source: 'EMPLOYEE_SITE_VISIT',
      originatingEmployeeId: 'E-102',
      currentEmployeeId: 'E-102',
      lifecycleStatus: 'NEW',
    },
  ]

  const siteVisits: SiteVisit[] = [
    {
      id: 'SV-1',
      employeeId: CURRENT_EMPLOYEE_ID,
      leadId: 'LEAD-1',
      projectId: 'PRJ-1',
      propertyId: 'PLOT-B114',
      visitAt: iso(-3, 11, 0),
      notes: 'Interested in corner plot, requested price breakdown.',
      outcome: 'FOLLOW_UP_REQUIRED',
      createdAt: iso(-3, 11, 5),
    },
    {
      id: 'SV-2',
      employeeId: CURRENT_EMPLOYEE_ID,
      leadId: 'LEAD-2',
      projectId: 'PRJ-2',
      propertyId: 'PLOT-42',
      visitAt: iso(-4, 14, 30),
      notes: 'Couple visited together, comparing with Divine Greens.',
      outcome: 'PROPOSAL_REQUESTED',
      createdAt: iso(-4, 14, 40),
    },
    {
      id: 'SV-3',
      employeeId: CURRENT_EMPLOYEE_ID,
      leadId: 'LEAD-3',
      projectId: 'PRJ-1',
      propertyId: 'PLOT-C208',
      visitAt: iso(-5, 10, 0),
      notes: 'First visit, general interest.',
      outcome: 'FOLLOW_UP_REQUIRED',
      createdAt: iso(-5, 10, 10),
    },
  ]

  const leadLocks: LeadLock[] = [
    { leadId: 'LEAD-1', employeeId: CURRENT_EMPLOYEE_ID, siteVisitId: 'SV-1', lockedAt: iso(-3, 11, 5), expiresAt: iso(2, 17, 5), status: 'ACTIVE' },
    { leadId: 'LEAD-2', employeeId: CURRENT_EMPLOYEE_ID, siteVisitId: 'SV-2', lockedAt: iso(-4, 14, 40), expiresAt: iso(1, 14, 40), status: 'ACTIVE' },
    { leadId: 'LEAD-3', employeeId: CURRENT_EMPLOYEE_ID, siteVisitId: 'SV-3', lockedAt: iso(-5, 10, 10), expiresAt: iso(0, 16, 10), status: 'ACTIVE' },
  ]

  const propertyLocks: PropertyLock[] = [
    { propertyId: 'PLOT-B114', employeeId: CURRENT_EMPLOYEE_ID, siteVisitId: 'SV-1', leadLockId: 'LEAD-1', lockedAt: iso(-3, 11, 5), expiresAt: iso(2, 17, 5), status: 'ACTIVE' },
    { propertyId: 'PLOT-42', employeeId: CURRENT_EMPLOYEE_ID, siteVisitId: 'SV-2', leadLockId: 'LEAD-2', lockedAt: iso(-4, 14, 40), expiresAt: iso(1, 14, 40), status: 'ACTIVE' },
    { propertyId: 'PLOT-C208', employeeId: CURRENT_EMPLOYEE_ID, siteVisitId: 'SV-3', leadLockId: 'LEAD-3', lockedAt: iso(-5, 10, 10), expiresAt: iso(0, 16, 10), status: 'ACTIVE' },
  ]

  const opportunities: Opportunity[] = [
    { id: 'OPP-1', leadId: 'LEAD-1', projectId: 'PRJ-1', propertyId: 'PLOT-B114', sourceOwnerType: 'EMPLOYEE', sourceOwnerId: CURRENT_EMPLOYEE_ID, handlingEmployeeId: CURRENT_EMPLOYEE_ID, source: 'EMPLOYEE_SITE_VISIT', status: 'ACTIVE', lockedAt: iso(-3, 11, 5), expiresAt: iso(2, 17, 5), attributionStatus: 'VERIFIED' },
    { id: 'OPP-2', leadId: 'LEAD-2', projectId: 'PRJ-2', propertyId: 'PLOT-42', sourceOwnerType: 'EMPLOYEE', sourceOwnerId: CURRENT_EMPLOYEE_ID, handlingEmployeeId: CURRENT_EMPLOYEE_ID, source: 'EMPLOYEE_SITE_VISIT', status: 'ACTIVE', lockedAt: iso(-4, 14, 40), expiresAt: iso(1, 14, 40), attributionStatus: 'VERIFIED' },
    { id: 'OPP-3', leadId: 'LEAD-3', projectId: 'PRJ-1', propertyId: 'PLOT-C208', sourceOwnerType: 'EMPLOYEE', sourceOwnerId: CURRENT_EMPLOYEE_ID, handlingEmployeeId: CURRENT_EMPLOYEE_ID, source: 'EMPLOYEE_SITE_VISIT', status: 'ACTIVE', lockedAt: iso(-5, 10, 10), expiresAt: iso(0, 16, 10), attributionStatus: 'VERIFIED' },
  ]

  const followUps: FollowUpAction[] = [
    { id: 'FU-1', leadId: 'LEAD-1', employeeId: CURRENT_EMPLOYEE_ID, actionType: 'CALL_LOGGED', loggedAt: iso(-1, 9, 0), notes: 'Confirmed budget range.' },
  ]

  const attendance: AttendanceRecord[] = [
    { id: 'ATT-0', employeeId: CURRENT_EMPLOYEE_ID, workDate: iso(0).slice(0, 10), checkInAt: iso(0, 9, 14), status: 'PRESENT' },
    { id: 'ATT-1', employeeId: CURRENT_EMPLOYEE_ID, workDate: iso(-1).slice(0, 10), checkInAt: iso(-1, 9, 20), checkOutAt: iso(-1, 18, 5), status: 'PRESENT' },
    { id: 'ATT-2', employeeId: CURRENT_EMPLOYEE_ID, workDate: iso(-2).slice(0, 10), checkInAt: iso(-2, 10, 5), checkOutAt: iso(-2, 18, 0), status: 'LATE' },
    { id: 'ATT-3', employeeId: CURRENT_EMPLOYEE_ID, workDate: iso(-3).slice(0, 10), status: 'ON_SITE_VISIT', checkInAt: iso(-3, 9, 0), checkOutAt: iso(-3, 17, 30) },
    { id: 'ATT-4', employeeId: CURRENT_EMPLOYEE_ID, workDate: iso(-4).slice(0, 10), status: 'DAY_OFF' },
  ]

  const dayOffs: WeeklyDayOff[] = [
    { employeeId: CURRENT_EMPLOYEE_ID, weekKey: weekKeyFor(iso(-4)), dayOffDate: iso(-4).slice(0, 10), status: 'COMPLETED', selectedAt: iso(-9), frozenAt: iso(-9) },
    { employeeId: CURRENT_EMPLOYEE_ID, weekKey: weekKeyFor(iso(3)), dayOffDate: iso(3).slice(0, 10), status: 'FROZEN', selectedAt: iso(-1), frozenAt: iso(-1) },
  ]

  const notifications: NotificationItem[] = [
    { id: 'N-1', employeeId: CURRENT_EMPLOYEE_ID, eventType: 'LOCK_EXPIRING', entityType: 'Lead', entityId: 'LEAD-3', message: 'Your lock on Priya Sehgal · Plot C-208 expires in 6 hours.', createdAt: iso(0, 8, 0) },
    { id: 'N-2', employeeId: CURRENT_EMPLOYEE_ID, eventType: 'SITE_VISIT_LOGGED', entityType: 'SiteVisit', entityId: 'SV-2', message: 'Site visit logged for Neha & Sameer Kapoor · Plot 42.', createdAt: iso(-4, 14, 41) },
    { id: 'N-3', employeeId: CURRENT_EMPLOYEE_ID, eventType: 'DAY_OFF_FROZEN', entityType: 'WeeklyDayOff', entityId: 'DO-2', message: 'Your Day Off for this week has been frozen.', createdAt: iso(-1, 9, 5) },
  ]

  return {
    employees,
    pendingSignups: [],
    projects,
    properties,
    leads,
    siteVisits,
    leadLocks,
    propertyLocks,
    followUps,
    attendance,
    dayOffs,
    opportunities,
    notifications,
  }
}
