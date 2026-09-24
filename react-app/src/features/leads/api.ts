import { apiFetch } from '@/lib/api/client'
import { liveFetch, liveFetchPaginated } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import type { FollowUpAction, Lead, LeadLock, Opportunity, Paginated, SiteVisit } from '@/lib/types/domain'

// ---- Leads list ----

interface LiveLeadRaw {
  id: string
  name: string
  normalized_phone?: string
  phone?: string
  email?: string
  source: Lead['source']
  originating_employee_id: string
  current_employee_id?: string
  lifecycle_status: Lead['lifecycleStatus']
  first_visit_at?: string
  latest_visit_at?: string
}

function adaptLiveLead(raw: LiveLeadRaw): Lead {
  return {
    id: raw.id,
    name: raw.name,
    normalizedPhone: raw.normalized_phone ?? raw.phone ?? '',
    phone: raw.phone ?? raw.normalized_phone ?? '',
    email: raw.email,
    source: raw.source,
    originatingEmployeeId: raw.originating_employee_id,
    currentEmployeeId: raw.current_employee_id,
    lifecycleStatus: raw.lifecycle_status,
    firstVisitAt: raw.first_visit_at,
    latestVisitAt: raw.latest_visit_at,
  }
}

export function fetchLeads(params: { page?: number; pageSize?: number; q?: string } = {}): Promise<Paginated<Lead>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10

  if (API_MODE === 'live') {
    const qs = new URLSearchParams({ page: String(page), page_size: String(pageSize), ...(params.q ? { q: params.q } : {}) })
    return liveFetchPaginated<LiveLeadRaw>(`/leads?${qs.toString()}`).then((res) => ({
      ...res,
      items: res.items.map(adaptLiveLead),
    }))
  }

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(params.q ? { q: params.q } : {}) })
  return apiFetch<Paginated<Lead>>(`/leads?${qs.toString()}`)
}

// ---- Lead detail (composed client-side for live — see note below) ----

export interface LeadDetail {
  lead: Lead
  visits: SiteVisit[]
  followUps: FollowUpAction[]
  activeLock: LeadLock | null
  opportunity: Opportunity | null
}

interface LiveFollowUpRaw {
  id: string
  lead_id: string
  employee_id: string
  action_type: FollowUpAction['actionType']
  logged_at: string
  notes?: string
  reference?: string
}

function adaptLiveFollowUp(raw: LiveFollowUpRaw): FollowUpAction {
  return {
    id: raw.id,
    leadId: raw.lead_id,
    employeeId: raw.employee_id,
    actionType: raw.action_type,
    loggedAt: raw.logged_at,
    notes: raw.notes,
    reference: raw.reference,
  }
}

interface LiveActiveLockRaw {
  lead_lock_id: string
  lead_id: string
  expires_at: string
}

/**
 * NOTE: the API guide doesn't document a combined "lead detail" payload (only
 * separate list/follow-up endpoints), so this composes it from three calls:
 * the lead itself, its follow-ups, and a client-side lookup against
 * /leads/active-locks and /opportunities for lock/attribution status. The
 * opportunity and lock lookups are best-effort (wrapped so a failure there
 * doesn't break the page) until the backend exposes something more direct —
 * flag this to the backend team if lead detail needs richer data in one call.
 */
async function fetchLeadDetailLive(leadId: string): Promise<LeadDetail> {
  const [lead, followUpsRaw] = await Promise.all([
    liveFetch<LiveLeadRaw>(`/leads/${leadId}`).then(adaptLiveLead),
    liveFetch<LiveFollowUpRaw[]>(`/leads/${leadId}/follow-ups`).catch(() => [] as LiveFollowUpRaw[]),
  ])

  let activeLock: LeadLock | null = null
  try {
    const locks = await liveFetch<LiveActiveLockRaw[]>('/leads/active-locks')
    const match = locks.find((l) => l.lead_id === leadId)
    if (match) {
      activeLock = {
        leadId: match.lead_id,
        employeeId: lead.currentEmployeeId ?? '',
        siteVisitId: '',
        lockedAt: '',
        expiresAt: match.expires_at,
        status: 'ACTIVE',
      }
    }
  } catch {
    // best-effort — omit lock info rather than failing the whole page
  }

  return {
    lead,
    followUps: followUpsRaw.map(adaptLiveFollowUp),
    // Per-lead visit history isn't a documented endpoint yet — left empty in
    // live mode rather than guessed at. See NOTE above.
    visits: [],
    activeLock,
    opportunity: null,
  }
}

async function fetchLeadDetailMock(leadId: string): Promise<LeadDetail> {
  return apiFetch<LeadDetail>(`/leads/${leadId}`)
}

export function fetchLeadDetail(leadId: string): Promise<LeadDetail> {
  return API_MODE === 'live' ? fetchLeadDetailLive(leadId) : fetchLeadDetailMock(leadId)
}

// ---- Follow-ups ----

function addFollowUpLive(
  leadId: string,
  input: { actionType: FollowUpAction['actionType']; notes?: string },
): Promise<FollowUpAction> {
  return liveFetch<LiveFollowUpRaw>(`/leads/${leadId}/follow-ups`, {
    method: 'POST',
    body: { action_type: input.actionType, notes: input.notes },
  }).then(adaptLiveFollowUp)
}

function addFollowUpMock(
  leadId: string,
  input: { actionType: FollowUpAction['actionType']; notes?: string },
): Promise<FollowUpAction> {
  return apiFetch<FollowUpAction>(`/leads/${leadId}/follow-up`, { method: 'POST', body: input })
}

export function addFollowUp(
  leadId: string,
  input: { actionType: FollowUpAction['actionType']; notes?: string },
): Promise<FollowUpAction> {
  return API_MODE === 'live' ? addFollowUpLive(leadId, input) : addFollowUpMock(leadId, input)
}

// ---- Opportunities ----

function updateOpportunityStatusLive(
  opportunityId: string,
  status: Opportunity['status'],
): Promise<Opportunity> {
  return liveFetch<Opportunity>(`/opportunities/${opportunityId}`, {
    method: 'PUT',
    body: { status },
  })
}

function updateOpportunityStatusMock(
  opportunityId: string,
  status: Opportunity['status'],
): Promise<Opportunity> {
  return apiFetch<Opportunity>(`/opportunities/${opportunityId}`, { method: 'PUT', body: { status } })
}

export function updateOpportunityStatus(
  opportunityId: string,
  status: Opportunity['status'],
): Promise<Opportunity> {
  return API_MODE === 'live' ? updateOpportunityStatusLive(opportunityId, status) : updateOpportunityStatusMock(opportunityId, status)
}
