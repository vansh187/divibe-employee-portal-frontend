import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createServer } from 'vite'

let server
let LeadDetailPage
let SiteVisitsListPage
let siteVisitApi

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', define: { 'import.meta.env.VITE_API_MODE': JSON.stringify('live') } })
  LeadDetailPage = (await server.ssrLoadModule('/src/features/leads/LeadDetailPage.tsx')).default
  SiteVisitsListPage = (await server.ssrLoadModule('/src/features/site-visits/SiteVisitsListPage.tsx')).default
  siteVisitApi = await server.ssrLoadModule('/src/features/site-visits/api.ts')
})

function renderVisits(visits) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['site-visits', { page: 1, pageSize: 10 }], { items: visits, page: 1, pageSize: 10, total: visits.length })
  try {
    return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, null, h(SiteVisitsListPage))))
  } finally { client.clear() }
}

const opportunity = { id: 'opp-1', leadId: 'lead-1', projectId: 'project-1', sourceOwnerType: 'EMPLOYEE', sourceOwnerId: 'employee-1', status: 'NEW' }
const siteVisit = { id: 'visit-1', leadId: 'lead-1', visitAt: '2026-09-26T10:30:00Z', visitorName: 'Visitor', opportunity, canUpdateOpportunity: true }

test('existing visits each display their opportunity and action controls', () => {
  const html = renderVisits([siteVisit, { ...siteVisit, id: 'visit-2' }])
  assert.equal((html.match(/Change Status/g) ?? []).length, 2)
  assert.equal((html.match(/>New</g) ?? []).length, 2)
})

test('expired, closed and unauthorized opportunities remain visible without actions', () => {
  for (const visit of [
    { ...siteVisit, canUpdateOpportunity: false },
    { ...siteVisit, opportunity: { ...opportunity, status: 'CONVERTED' } },
    { ...siteVisit, opportunity: { ...opportunity, expiresAt: '2000-01-01T00:00:00Z' } },
  ]) {
    const html = renderVisits([visit])
    assert.match(html, /Source/)
    assert.doesNotMatch(html, /Change Status/)
  }
})

test('in-progress opportunities do not offer backward pipeline transitions', () => {
  const html = renderVisits([{ ...siteVisit, opportunity: { ...opportunity, status: 'DEAL_IN_PROGRESS' } }])
  assert.doesNotMatch(html, /value="INTERESTED"/)
  assert.match(html, /value="CONVERTED"/)
})

test('a visit without a visible opportunity has a safe fallback', () => {
  assert.match(renderVisits([{ ...siteVisit, opportunity: null }]), /Opportunity unavailable/)
})

test('live list and create responses preserve the linked opportunity', async (t) => {
  const rawOpportunity = { id: 'opp-1', lead_id: 'lead-1', project_id: 'project-1', source_owner_type: 'EMPLOYEE', source_owner_employee_id: 'employee-1', status: 'NEW' }
  const rawVisit = { id: 'visit-1', employee_id: 'employee-1', lead_id: 'lead-1', project_id: 'project-1', opportunity: rawOpportunity, can_update_opportunity: true }
  t.mock.method(globalThis, 'fetch', async (_url, options) => new Response(JSON.stringify(options?.method === 'POST'
    ? { success: true, data: rawVisit }
    : { success: true, data: [rawVisit], pagination: { page: 1, page_size: 20, total_items: 1, total_pages: 1 } }), { status: 200 }))
  const list = await siteVisitApi.fetchSiteVisits()
  assert.equal(list.items[0].opportunity.id, 'opp-1')
  assert.equal(list.items[0].canUpdateOpportunity, true)
  const created = await siteVisitApi.createSiteVisit({ visitorName: 'Visitor', phone: '9000000000', projectId: 'project-1', visitAt: '2026-09-26T10:30:00Z', idempotencyKey: 'test-key' })
  assert.equal(created.opportunity.id, 'opp-1')
})
after(async () => { await server?.close() })

function renderOpportunity(status) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['lead', 'test-lead'], {
    lead: { id: 'test-lead', name: 'Test Lead', phone: '9000000000' },
    visits: [], followUps: [], activeLock: null,
    opportunities: [{
      id: 'test-opportunity', leadId: 'test-lead', projectId: 'test-project',
      sourceOwnerType: 'EMPLOYEE', sourceOwnerId: 'test-employee',
      source: 'EMPLOYEE_SITE_VISIT', status, attributionStatus: 'VERIFIED',
    }],
  })
  try {
    return renderToStaticMarkup(h(QueryClientProvider, { client },
      h(MemoryRouter, { initialEntries: ['/leads/test-lead'] },
        h(Routes, null, h(Route, { path: '/leads/:leadId', element: h(LeadDetailPage) }))),
    ))
  } finally {
    client.clear()
  }
}

test('a newly created opportunity renders its New badge and status controls', () => {
  const html = renderOpportunity('NEW')
  assert.match(html, />New</)
  assert.match(html, /Change Status/)
  assert.match(html, /value="INTERESTED"/)
})

test('all backend opportunity statuses render without a runtime exception', () => {
  for (const status of ['NEW', 'ACTIVE', 'INTERESTED', 'DEAL_IN_PROGRESS', 'CONVERTED', 'DEAL_REJECTED', 'LOST', 'EXPIRED', 'RELEASED', 'ATTRIBUTION_CONFLICT']) {
    assert.doesNotThrow(() => renderOpportunity(status), status)
  }
})

test('an unfamiliar API status renders safely without enabling status changes', () => {
  for (const status of ['FUTURE_STATUS', null, undefined, 'constructor']) {
    const html = renderOpportunity(status)
    assert.match(html, /Unknown status/)
    assert.doesNotMatch(html, /Change Status/)
  }
})
