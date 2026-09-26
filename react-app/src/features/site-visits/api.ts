import { apiFetch } from '@/lib/api/client'
import { liveFetch, liveFetchPaginated } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import { adaptLiveOpportunity, type LiveOpportunityRaw } from '@/features/leads/api'
import type { Lead, Opportunity, Paginated, Project, PropertyUnit, SiteVisit, SiteVisitOutcome } from '@/lib/types/domain'

export interface SiteVisitWithRefs extends SiteVisit {
  // What was actually typed on THIS visit's form — can differ from the lead's
  // master name/phone/email for a returning customer (see backend §8).
  visitorName?: string
  visitorPhone?: string
  visitorEmail?: string
  lead?: Lead
  project?: Project
  property?: PropertyUnit
  opportunity?: Opportunity | null
  canUpdateOpportunity?: boolean
}

interface LiveSiteVisitRaw {
  id: string
  employee_id: string
  lead_id: string
  project_id: string
  property_id?: string
  visit_at: string
  notes?: string
  attachments?: string[]
  outcome?: SiteVisitOutcome
  created_at: string
  visitor_name?: string
  visitor_phone?: string
  visitor_email?: string
  lead_name?: string
  project_name?: string
  plot_no?: string
  opportunity?: LiveOpportunityRaw | null
  can_update_opportunity?: boolean
}

function adaptLiveSiteVisit(raw: LiveSiteVisitRaw): SiteVisitWithRefs {
  return {
    id: raw.id,
    employeeId: raw.employee_id,
    leadId: raw.lead_id,
    projectId: raw.project_id,
    propertyId: raw.property_id,
    visitAt: raw.visit_at,
    notes: raw.notes,
    attachments: raw.attachments,
    outcome: raw.outcome,
    createdAt: raw.created_at,
    visitorName: raw.visitor_name,
    visitorPhone: raw.visitor_phone,
    visitorEmail: raw.visitor_email,
    lead: raw.lead_name ? ({ name: raw.lead_name } as Lead) : undefined,
    project: raw.project_name ? ({ name: raw.project_name } as Project) : undefined,
    property: raw.plot_no ? ({ code: raw.plot_no } as PropertyUnit) : undefined,
    opportunity: raw.opportunity ? adaptLiveOpportunity(raw.opportunity) : null,
    canUpdateOpportunity: raw.can_update_opportunity ?? false,
  }
}

export function fetchSiteVisits(params: { page?: number; pageSize?: number } = {}): Promise<Paginated<SiteVisitWithRefs>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20

  if (API_MODE === 'live') {
    return liveFetchPaginated<LiveSiteVisitRaw>(`/site-visits?page=${page}&page_size=${pageSize}`).then((res) => ({
      ...res,
      items: res.items.map(adaptLiveSiteVisit),
    }))
  }

  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  return apiFetch<Paginated<SiteVisitWithRefs>>(`/site-visits?${qs.toString()}`)
}

export interface CreateSiteVisitInput {
  visitorName: string
  phone: string
  email?: string
  projectId: string
  propertyId?: string
  visitAt: string
  notes?: string
  outcome?: SiteVisitOutcome
  /** Generated once when the form opens and reused on retry so a resubmit doesn't create a duplicate visit. */
  idempotencyKey: string
}

export interface CreateSiteVisitResult {
  visit: SiteVisit
  lead: Lead
  opportunity?: Opportunity
}

interface LiveCreateSiteVisitRaw {
  id: string
  employee_id: string
  lead_id: string
  project_id: string
  property_id?: string
  visit_at: string
  notes?: string
  outcome?: SiteVisitOutcome
  created_at: string
  opportunity?: LiveOpportunityRaw | null
  lead?: { id: string; name: string; normalized_phone?: string; phone?: string; email?: string }
}

function createSiteVisitLive(input: CreateSiteVisitInput): Promise<CreateSiteVisitResult> {
  return liveFetch<LiveCreateSiteVisitRaw>('/site-visits', {
    method: 'POST',
    body: {
      visitor_name: input.visitorName,
      phone: input.phone,
      email: input.email || null,
      project_id: input.projectId,
      property_id: input.propertyId || null,
      visit_at: input.visitAt,
      notes: input.notes,
      outcome: input.outcome || null,
      idempotency_key: input.idempotencyKey,
    },
  }).then((raw) => ({
    opportunity: raw.opportunity ? adaptLiveOpportunity(raw.opportunity) : undefined,
    visit: {
      id: raw.id,
      employeeId: raw.employee_id,
      leadId: raw.lead_id,
      projectId: raw.project_id,
      propertyId: raw.property_id,
      visitAt: raw.visit_at,
      notes: raw.notes,
      outcome: raw.outcome,
      createdAt: raw.created_at,
    },
    lead: raw.lead
      ? {
          id: raw.lead.id,
          name: raw.lead.name,
          normalizedPhone: raw.lead.normalized_phone ?? '',
          phone: raw.lead.phone ?? input.phone,
          email: raw.lead.email,
          source: 'EMPLOYEE_SITE_VISIT',
          originatingEmployeeId: raw.employee_id,
          currentEmployeeId: raw.employee_id,
          lifecycleStatus: 'IN_PROGRESS',
        }
      : // Fallback if the create response doesn't embed the lead — caller should re-fetch by id.
        ({ id: raw.lead_id, name: input.visitorName, normalizedPhone: '', phone: input.phone, source: 'EMPLOYEE_SITE_VISIT', originatingEmployeeId: raw.employee_id, currentEmployeeId: raw.employee_id, lifecycleStatus: 'IN_PROGRESS' } as Lead),
  }))
}

function createSiteVisitMock(input: CreateSiteVisitInput): Promise<CreateSiteVisitResult> {
  return apiFetch<CreateSiteVisitResult>('/site-visits', { method: 'POST', body: input })
}

export function createSiteVisit(input: CreateSiteVisitInput): Promise<CreateSiteVisitResult> {
  return API_MODE === 'live' ? createSiteVisitLive(input) : createSiteVisitMock(input)
}
