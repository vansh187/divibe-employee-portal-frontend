import { http, HttpResponse, delay } from 'msw'
import { getDb, saveDb, nextId } from '@/lib/mock/store'
import { weekKeyFor } from '@/lib/week'
import { LOCK_WINDOW_DAYS } from '@/lib/constants'
import type { MockEmployee } from '@/lib/mock/seed'
import type {
  ApiErrorBody,
  AttendanceRecord,
  FollowUpAction,
  Lead,
  LeadLock,
  Opportunity,
  Paginated,
  PropertyLock,
  SiteVisit,
} from '@/lib/types/domain'

const API = '/api'
const LATENCY = 350

function err(status: number, body: ApiErrorBody) {
  return HttpResponse.json(body, { status })
}

function paginate<T>(items: T[], url: URL): Paginated<T> {
  const page = Number(url.searchParams.get('page') ?? '1')
  const pageSize = Number(url.searchParams.get('pageSize') ?? '20')
  const start = (page - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    total: items.length,
  }
}

function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '').replace(/^0+/, '')
}

function requireAuth(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? ''
  const match = auth.match(/^Bearer mock-access-(.+)-\d+$/)
  return match ? match[1] : null
}

export const handlers = [
  // ---------- Auth ----------
  http.post(`${API}/auth/login`, async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { email: string; password: string }
    const db = getDb()
    const employee = db.employees.find((e) => e.email.toLowerCase() === body.email?.toLowerCase())
    // Seeded demo accounts have a password on record but accept any non-empty value;
    // signup-created accounts must match exactly.
    const passwordOk = !!body.password && (!employee?.password || employee.password === body.password)
    if (!employee || !passwordOk) {
      return err(401, { code: 'UNAUTHORIZED', message: 'Invalid work email or password.' })
    }
    const accessToken = `mock-access-${employee.id}-${Date.now()}`
    const refreshToken = `mock-refresh-${employee.id}-${Date.now()}`
    return HttpResponse.json({ accessToken, refreshToken, employee })
  }),

  // ---------- Signup (email OTP verification) ----------
  http.post(`${API}/auth/signup`, async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { name: string; email: string; employeeId: string; password: string }
    const db = getDb()
    const email = body.email?.trim().toLowerCase()

    if (!body.name?.trim() || !email || !body.employeeId?.trim() || !body.password || body.password.length < 8) {
      return err(422, { code: 'VALIDATION_FAILED', message: 'Please fill in every field. Password must be at least 8 characters.' })
    }
    if (db.employees.some((e) => e.email.toLowerCase() === email)) {
      return err(409, { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists.' })
    }
    if (db.employees.some((e) => e.employeeCode?.toLowerCase() === body.employeeId.trim().toLowerCase())) {
      return err(409, { code: 'EMPLOYEE_ID_ALREADY_REGISTERED', message: 'This Employee ID is already registered.' })
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)

    db.pendingSignups = db.pendingSignups.filter((p) => p.email !== email)
    db.pendingSignups.push({
      email,
      name: body.name.trim(),
      employeeCode: body.employeeId.trim(),
      password: body.password,
      otp,
      otpExpiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
    })
    saveDb()

    // No real mailbox in mock mode — the OTP is echoed back so the form can show it.
    // eslint-disable-next-line no-console
    console.info(`[mock] Signup OTP for ${email}: ${otp}`)
    return HttpResponse.json({ email, devOtp: otp, expiresAt: expiresAt.toISOString() }, { status: 201 })
  }),

  http.post(`${API}/auth/signup/resend-otp`, async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { email: string }
    const db = getDb()
    const email = body.email?.trim().toLowerCase()
    const pending = db.pendingSignups.find((p) => p.email === email)
    if (!pending) return err(404, { code: 'NOT_FOUND', message: 'Start the signup form again — this session expired.' })

    pending.otp = String(Math.floor(100000 + Math.random() * 900000))
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 10)
    pending.otpExpiresAt = expiresAt.toISOString()
    saveDb()

    // eslint-disable-next-line no-console
    console.info(`[mock] Resent signup OTP for ${email}: ${pending.otp}`)
    return HttpResponse.json({ email, devOtp: pending.otp, expiresAt: pending.otpExpiresAt })
  }),

  http.post(`${API}/auth/signup/verify-otp`, async ({ request }) => {
    await delay(LATENCY)
    const body = (await request.json()) as { email: string; otp: string }
    const db = getDb()
    const email = body.email?.trim().toLowerCase()
    const pending = db.pendingSignups.find((p) => p.email === email)
    if (!pending) return err(404, { code: 'NOT_FOUND', message: 'Start the signup form again — this session expired.' })
    if (new Date(pending.otpExpiresAt) < new Date()) {
      return err(410, { code: 'OTP_EXPIRED', message: 'This code has expired. Request a new one.' })
    }
    if (pending.otp !== body.otp?.trim()) {
      return err(422, { code: 'INVALID_OTP', message: 'That code is incorrect. Please check and try again.' })
    }

    const employee: MockEmployee = {
      id: nextId('E'),
      employeeCode: pending.employeeCode,
      name: pending.name,
      email: pending.email,
      status: 'ACTIVE',
      avatarInitials: pending.name
        .split(/\s+/)
        .map((p) => p[0])
        .slice(0, 2)
        .join('')
        .toUpperCase(),
      password: pending.password,
    }
    db.employees.push(employee)
    db.pendingSignups = db.pendingSignups.filter((p) => p.email !== email)
    saveDb()

    const accessToken = `mock-access-${employee.id}-${Date.now()}`
    const refreshToken = `mock-refresh-${employee.id}-${Date.now()}`
    return HttpResponse.json({ accessToken, refreshToken, employee })
  }),

  http.post(`${API}/auth/refresh`, async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as { refreshToken: string }
    const match = body.refreshToken?.match(/^mock-refresh-(.+)-\d+$/)
    if (!match) return err(401, { code: 'UNAUTHORIZED', message: 'Session expired. Please sign in again.' })
    const employeeId = match[1]
    const accessToken = `mock-access-${employeeId}-${Date.now()}`
    return HttpResponse.json({ accessToken })
  }),

  http.post(`${API}/auth/logout`, async () => {
    await delay(100)
    return HttpResponse.json({ ok: true })
  }),

  http.get(`${API}/auth/me`, async ({ request }) => {
    await delay(200)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const employee = getDb().employees.find((e) => e.id === employeeId)
    if (!employee) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    return HttpResponse.json(employee)
  }),

  // ---------- Dashboard ----------
  http.get(`${API}/dashboard/summary`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const todayStr = new Date().toISOString().slice(0, 10)

    const visitsToday = db.siteVisits.filter(
      (v) => v.employeeId === employeeId && v.visitAt.slice(0, 10) === todayStr,
    ).length

    const activeLocks = db.leadLocks.filter(
      (l) => l.employeeId === employeeId && l.status === 'ACTIVE' && new Date(l.expiresAt) > new Date(),
    ).length

    const conversionsThisWeek = db.opportunities.filter(
      (o) => o.handlingEmployeeId === employeeId && o.status === 'CONVERTED',
    ).length

    const today = db.attendance.find((a) => a.employeeId === employeeId && a.workDate === todayStr)
    const nextDayOff = db.dayOffs
      .filter((d) => d.employeeId === employeeId && new Date(d.dayOffDate) >= new Date(todayStr))
      .sort((a, b) => a.dayOffDate.localeCompare(b.dayOffDate))[0]

    return HttpResponse.json({
      visitsToday,
      activeLocks,
      conversionsThisWeek,
      todayAttendance: today ?? null,
      nextDayOff: nextDayOff ?? null,
    })
  }),

  // ---------- Locks ----------
  http.get(`${API}/locks/active`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const now = new Date()
    const locks = db.leadLocks
      .filter((l) => l.employeeId === employeeId && l.status === 'ACTIVE' && new Date(l.expiresAt) > now)
      .map((lock) => {
        const lead = db.leads.find((x) => x.id === lock.leadId)
        const propLock = db.propertyLocks.find((p) => p.leadLockId === lock.leadId && p.status === 'ACTIVE')
        const property = propLock ? db.properties.find((p) => p.id === propLock.propertyId) : undefined
        const project = property ? db.projects.find((p) => p.id === property.projectId) : undefined
        const lastVisit = db.siteVisits
          .filter((v) => v.leadId === lock.leadId)
          .sort((a, b) => b.visitAt.localeCompare(a.visitAt))[0]
        return { lock, lead, property, project, lastVisitAt: lastVisit?.visitAt }
      })
      .sort((a, b) => a.lock.expiresAt.localeCompare(b.lock.expiresAt))
    return HttpResponse.json(locks)
  }),

  // ---------- Projects / Properties ----------
  http.get(`${API}/projects`, async ({ request }) => {
    await delay(LATENCY)
    if (!requireAuth(request)) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    return HttpResponse.json(getDb().projects)
  }),

  http.get(`${API}/projects/:projectId/properties`, async ({ request, params }) => {
    await delay(LATENCY)
    if (!requireAuth(request)) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const list = getDb().properties.filter((p) => p.projectId === params.projectId)
    return HttpResponse.json(list)
  }),

  // ---------- Leads ----------
  http.get(`${API}/leads`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const url = new URL(request.url)
    const search = (url.searchParams.get('q') ?? '').toLowerCase()
    const db = getDb()
    let leads = db.leads.filter((l) => l.currentEmployeeId === employeeId || l.originatingEmployeeId === employeeId)
    if (search) {
      leads = leads.filter((l) => l.name.toLowerCase().includes(search) || l.phone.includes(search))
    }
    leads = [...leads].sort((a, b) => (b.latestVisitAt ?? '').localeCompare(a.latestVisitAt ?? ''))
    return HttpResponse.json(paginate(leads, url))
  }),

  http.get(`${API}/leads/:leadId`, async ({ request, params }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const lead = db.leads.find((l) => l.id === params.leadId)
    if (!lead) return err(404, { code: 'NOT_FOUND', message: 'Lead not found.' })
    const visits = db.siteVisits.filter((v) => v.leadId === lead.id).sort((a, b) => b.visitAt.localeCompare(a.visitAt))
    const followUps = db.followUps.filter((f) => f.leadId === lead.id).sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
    const activeLock = db.leadLocks.find((l) => l.leadId === lead.id && l.status === 'ACTIVE' && new Date(l.expiresAt) > new Date())
    const opportunity = db.opportunities.find((o) => o.leadId === lead.id && o.status !== 'RELEASED')
    return HttpResponse.json({ lead, visits, followUps, activeLock: activeLock ?? null, opportunity: opportunity ?? null })
  }),

  http.post(`${API}/leads/:leadId/follow-up`, async ({ request, params }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const lead = db.leads.find((l) => l.id === params.leadId)
    if (!lead) return err(404, { code: 'NOT_FOUND', message: 'Lead not found.' })
    const body = (await request.json()) as { actionType: FollowUpAction['actionType']; notes?: string }

    const followUp: FollowUpAction = {
      id: nextId('FU'),
      leadId: lead.id,
      employeeId,
      actionType: body.actionType,
      loggedAt: new Date().toISOString(),
      notes: body.notes,
    }
    db.followUps.push(followUp)

    // Qualifying action renews the 3-day protection window (spec §5).
    const isQualifying =
      body.actionType === 'CALL_LOGGED' || body.actionType === 'NEXT_VISIT_SCHEDULED' || body.actionType === 'PROPOSAL_SENT'
    if (isQualifying) {
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + LOCK_WINDOW_DAYS)
      const leadLock = db.leadLocks.find((l) => l.leadId === lead.id && l.status === 'ACTIVE')
      if (leadLock) leadLock.expiresAt = newExpiry.toISOString()
      const propLock = db.propertyLocks.find((p) => p.leadLockId === lead.id && p.status === 'ACTIVE')
      if (propLock) propLock.expiresAt = newExpiry.toISOString()
      const opp = db.opportunities.find((o) => o.leadId === lead.id && o.status === 'ACTIVE')
      if (opp) opp.expiresAt = newExpiry.toISOString()
    }
    saveDb()
    return HttpResponse.json(followUp, { status: 201 })
  }),

  // Mirrors POST /api/v1/opportunities/:id/status on the live backend — only
  // CONVERTED, LOST, RELEASED are settable; ACTIVE/EXPIRED/ATTRIBUTION_CONFLICT
  // are backend-derived.
  http.post(`${API}/opportunities/:opportunityId/status`, async ({ request, params }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const opportunity = db.opportunities.find((o) => o.id === params.opportunityId)
    if (!opportunity) return err(404, { code: 'NOT_FOUND', message: 'Opportunity not found.' })

    const body = (await request.json()) as { status?: string }
    const allowed = ['CONVERTED', 'LOST', 'RELEASED']
    if (!body.status || !allowed.includes(body.status)) {
      return err(422, { code: 'VALIDATION_FAILED', message: `status must be one of ${allowed.join(', ')}.` })
    }
    if (opportunity.status !== 'ACTIVE') {
      return err(409, {
        code: 'OPPORTUNITY_NOT_ACTIVE',
        message: `Opportunity is '${opportunity.status}'; only an ACTIVE opportunity can be updated.`,
      })
    }
    if (body.status === 'CONVERTED' && opportunity.propertyId) {
      const alreadySold = db.opportunities.some(
        (o) => o.id !== opportunity.id && o.propertyId === opportunity.propertyId && o.status === 'CONVERTED',
      )
      if (alreadySold) return err(409, { code: 'DEAL_LOCKED', message: 'This plot already has an active deal.' })
      const property = db.properties.find((p) => p.id === opportunity.propertyId)
      if (property) property.availability = 'SOLD'
    }

    opportunity.status = body.status as Opportunity['status']
    saveDb()
    return HttpResponse.json(opportunity)
  }),

  // ---------- Site Visits ----------
  http.get(`${API}/site-visits`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const url = new URL(request.url)
    const db = getDb()
    const visits = db.siteVisits
      .filter((v) => v.employeeId === employeeId)
      .sort((a, b) => b.visitAt.localeCompare(a.visitAt))
      .map((v) => ({
        ...v,
        lead: db.leads.find((l) => l.id === v.leadId),
        project: db.projects.find((p) => p.id === v.projectId),
        property: db.properties.find((p) => p.id === v.propertyId),
      }))
    return HttpResponse.json(paginate(visits, url))
  }),

  http.post(`${API}/site-visits`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })

    const body = (await request.json()) as {
      visitorName: string
      phone: string
      email?: string
      projectId: string
      propertyId?: string
      visitAt: string
      notes?: string
      outcome?: SiteVisit['outcome']
    }

    const db = getDb()
    const visitDate = body.visitAt.slice(0, 10)

    // 1. Day-off conflict check (spec §4, §7).
    const frozenDayOff = db.dayOffs.find(
      (d) => d.employeeId === employeeId && d.status === 'FROZEN' && d.dayOffDate === visitDate,
    )
    if (frozenDayOff) {
      return err(409, {
        code: 'DAY_OFF_CONFLICT',
        message: 'This date is your frozen Day Off. Site visits cannot be logged on a Day Off.',
      })
    }

    // 2. Resolve or create Master Lead via normalized phone (spec §3, §16.3).
    const normalizedPhone = normalizePhone(body.phone)
    let lead = db.leads.find((l) => l.normalizedPhone === normalizedPhone)
    const isNewLead = !lead
    if (!lead) {
      lead = {
        id: nextId('LEAD'),
        name: body.visitorName,
        normalizedPhone,
        phone: body.phone,
        email: body.email,
        source: 'EMPLOYEE_SITE_VISIT',
        originatingEmployeeId: employeeId,
        currentEmployeeId: employeeId,
        lifecycleStatus: 'NEW',
      }
      db.leads.push(lead)
    }

    // 3. Lead lock conflict check.
    const now = new Date()
    const activeLeadLock = db.leadLocks.find(
      (l) => l.leadId === lead!.id && l.status === 'ACTIVE' && new Date(l.expiresAt) > now,
    )
    if (activeLeadLock && activeLeadLock.employeeId !== employeeId) {
      return err(409, {
        code: 'LEAD_LOCKED',
        message: 'This lead is currently locked to another employee.',
        details: { expiresAt: activeLeadLock.expiresAt },
      })
    }

    // 4. Property lock conflict check (only if a specific plot was selected).
    if (body.propertyId) {
      const activePropLock = db.propertyLocks.find(
        (p) => p.propertyId === body.propertyId && p.status === 'ACTIVE' && new Date(p.expiresAt) > now,
      )
      if (activePropLock && activePropLock.employeeId !== employeeId) {
        return err(409, {
          code: 'PROPERTY_LOCKED',
          message: 'This plot/property is currently locked to another employee.',
          details: { expiresAt: activePropLock.expiresAt },
        })
      }
    }

    // 5. Unified Opportunity conflict check (REQ-25 §16.6) — same engine as lock check above,
    // since employee-only V1 has no Channel Partner UI, but the shape mirrors the spec so a
    // Channel Partner surface can plug into the same rules later.
    let opportunity: Opportunity | undefined = body.propertyId
      ? db.opportunities.find((o) => o.leadId === lead!.id && o.propertyId === body.propertyId && o.status === 'ACTIVE')
      : undefined

    // 6. Transactional creation: Lead resolution + Site Visit + locks + opportunity all together.
    const visit: SiteVisit = {
      id: nextId('SV'),
      employeeId,
      leadId: lead.id,
      projectId: body.projectId,
      propertyId: body.propertyId,
      visitAt: body.visitAt,
      notes: body.notes,
      outcome: body.outcome,
      createdAt: new Date().toISOString(),
    }
    db.siteVisits.push(visit)

    lead.currentEmployeeId = employeeId
    lead.latestVisitAt = visit.visitAt
    if (!lead.firstVisitAt) lead.firstVisitAt = visit.visitAt
    if (lead.lifecycleStatus === 'NEW') lead.lifecycleStatus = 'IN_PROGRESS'

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + LOCK_WINDOW_DAYS)

    let leadLock = activeLeadLock
    if (!leadLock) {
      leadLock = {
        leadId: lead.id,
        employeeId,
        siteVisitId: visit.id,
        lockedAt: new Date().toISOString(),
        expiresAt: expiresAt.toISOString(),
        status: 'ACTIVE',
      } satisfies LeadLock
      db.leadLocks.push(leadLock)
    } else {
      leadLock.expiresAt = expiresAt.toISOString()
      leadLock.siteVisitId = visit.id
    }

    if (body.propertyId) {
      const existingPropLock = db.propertyLocks.find((p) => p.propertyId === body.propertyId && p.status === 'ACTIVE')
      if (!existingPropLock) {
        const propLock: PropertyLock = {
          propertyId: body.propertyId,
          employeeId,
          siteVisitId: visit.id,
          leadLockId: lead.id,
          lockedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          status: 'ACTIVE',
        }
        db.propertyLocks.push(propLock)
      } else {
        existingPropLock.expiresAt = expiresAt.toISOString()
        existingPropLock.siteVisitId = visit.id
      }
      const property = db.properties.find((p) => p.id === body.propertyId)
      if (property && property.availability === 'AVAILABLE') property.availability = 'LOCKED'

      if (!opportunity) {
        opportunity = {
          id: nextId('OPP'),
          leadId: lead.id,
          projectId: body.projectId,
          propertyId: body.propertyId,
          sourceOwnerType: 'EMPLOYEE',
          sourceOwnerId: employeeId,
          handlingEmployeeId: employeeId,
          source: 'EMPLOYEE_SITE_VISIT',
          status: 'ACTIVE',
          lockedAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          attributionStatus: 'VERIFIED',
        }
        db.opportunities.push(opportunity)
      } else {
        opportunity.expiresAt = expiresAt.toISOString()
      }
    }

    // Attendance derives an On-Site Visit marker for the day (informational; check-in/out remains separate).
    const attendanceForDay = db.attendance.find((a) => a.employeeId === employeeId && a.workDate === visitDate)
    if (!attendanceForDay) {
      db.attendance.push({
        id: nextId('ATT'),
        employeeId,
        workDate: visitDate,
        status: 'ON_SITE_VISIT',
      })
    }

    db.notifications.unshift({
      id: nextId('N'),
      employeeId,
      eventType: isNewLead ? 'LEAD_CREATED' : 'SITE_VISIT_LOGGED',
      entityType: 'SiteVisit',
      entityId: visit.id,
      message: `Site visit logged for ${lead.name}${body.propertyId ? ` · ${db.properties.find((p) => p.id === body.propertyId)?.code}` : ''}.`,
      createdAt: new Date().toISOString(),
    })

    saveDb()
    return HttpResponse.json({ visit, lead, leadLock, opportunity }, { status: 201 })
  }),

  // ---------- Attendance ----------
  http.get(`${API}/attendance`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const url = new URL(request.url)
    const records = getDb()
      .attendance.filter((a) => a.employeeId === employeeId)
      .sort((a, b) => b.workDate.localeCompare(a.workDate))
    return HttpResponse.json(paginate(records, url))
  }),

  http.post(`${API}/attendance/check-in`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    let record = db.attendance.find((a) => a.employeeId === employeeId && a.workDate === today)
    const now = new Date()
    const isLate = now.getHours() >= 10
    if (record?.checkInAt) {
      return err(409, { code: 'VALIDATION_ERROR', message: 'You have already checked in today.' })
    }
    if (!record) {
      record = { id: nextId('ATT'), employeeId, workDate: today, status: isLate ? 'LATE' : 'PRESENT' }
      db.attendance.push(record)
    }
    record.checkInAt = now.toISOString()
    record.status = isLate ? 'LATE' : 'PRESENT'
    saveDb()
    return HttpResponse.json(record satisfies AttendanceRecord)
  }),

  http.post(`${API}/attendance/check-out`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const today = new Date().toISOString().slice(0, 10)
    const record = db.attendance.find((a) => a.employeeId === employeeId && a.workDate === today)
    if (!record?.checkInAt) {
      return err(409, { code: 'VALIDATION_ERROR', message: 'Check in before checking out.' })
    }
    if (record.checkOutAt) {
      return err(409, { code: 'VALIDATION_ERROR', message: 'You have already checked out today.' })
    }
    record.checkOutAt = new Date().toISOString()
    saveDb()
    return HttpResponse.json(record)
  }),

  // ---------- Weekly Day-Off ----------
  http.get(`${API}/day-off/calendar`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const records = getDb()
      .dayOffs.filter((d) => d.employeeId === employeeId)
      .sort((a, b) => b.dayOffDate.localeCompare(a.dayOffDate))
    return HttpResponse.json(records)
  }),

  http.post(`${API}/day-off/select`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const body = (await request.json()) as { date: string }
    const db = getDb()

    const hasVisit = db.siteVisits.some((v) => v.employeeId === employeeId && v.visitAt.slice(0, 10) === body.date)
    if (hasVisit) {
      return err(409, {
        code: 'VALIDATION_ERROR',
        message: 'A Site Visit already exists on this date. Choose a different Day Off date.',
      })
    }

    const weekKey = weekKeyFor(body.date)
    const existingForWeek = db.dayOffs.find((d) => d.employeeId === employeeId && d.weekKey === weekKey)
    if (existingForWeek?.status === 'FROZEN') {
      return err(409, { code: 'VALIDATION_ERROR', message: 'This week’s Day Off is already frozen.' })
    }

    if (existingForWeek) {
      existingForWeek.dayOffDate = body.date
      existingForWeek.status = 'SELECTED'
      existingForWeek.selectedAt = new Date().toISOString()
      saveDb()
      return HttpResponse.json(existingForWeek)
    }

    const record = {
      employeeId,
      weekKey,
      dayOffDate: body.date,
      status: 'SELECTED' as const,
      selectedAt: new Date().toISOString(),
    }
    db.dayOffs.push(record)
    saveDb()
    return HttpResponse.json(record, { status: 201 })
  }),

  http.post(`${API}/day-off/freeze`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const body = (await request.json()) as { weekKey: string }
    const db = getDb()
    const record = db.dayOffs.find((d) => d.employeeId === employeeId && d.weekKey === body.weekKey)
    if (!record) return err(404, { code: 'NOT_FOUND', message: 'No selected Day Off found for this week.' })
    if (record.status === 'FROZEN') return HttpResponse.json(record)

    const hasVisit = db.siteVisits.some((v) => v.employeeId === employeeId && v.visitAt.slice(0, 10) === record.dayOffDate)
    if (hasVisit) {
      return err(409, {
        code: 'VALIDATION_ERROR',
        message: 'A Site Visit was logged for this date after selection. Choose a different Day Off date.',
      })
    }

    record.status = 'FROZEN'
    record.frozenAt = new Date().toISOString()

    const attForDay = db.attendance.find((a) => a.employeeId === employeeId && a.workDate === record.dayOffDate)
    if (attForDay) attForDay.status = 'DAY_OFF'
    else db.attendance.push({ id: nextId('ATT'), employeeId, workDate: record.dayOffDate, status: 'DAY_OFF' })

    db.notifications.unshift({
      id: nextId('N'),
      employeeId,
      eventType: 'DAY_OFF_FROZEN',
      entityType: 'WeeklyDayOff',
      entityId: record.weekKey,
      message: `Your Day Off on ${record.dayOffDate} has been frozen.`,
      createdAt: new Date().toISOString(),
    })

    saveDb()
    return HttpResponse.json(record)
  }),

  // ---------- Notifications ----------
  http.get(`${API}/notifications`, async ({ request }) => {
    await delay(LATENCY)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const url = new URL(request.url)
    const items = getDb()
      .notifications.filter((n) => n.employeeId === employeeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return HttpResponse.json(paginate(items, url))
  }),

  http.post(`${API}/notifications/:notificationId/read`, async ({ request, params }) => {
    await delay(150)
    const employeeId = requireAuth(request)
    if (!employeeId) return err(401, { code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    const db = getDb()
    const notification = db.notifications.find((n) => n.id === params.notificationId && n.employeeId === employeeId)
    if (!notification) return err(404, { code: 'NOT_FOUND', message: 'Notification not found.' })
    notification.readAt = new Date().toISOString()
    saveDb()
    return HttpResponse.json({ ok: true })
  }),
]

// Re-exported so callers can build query strings without importing the type separately.
export type { Lead }
