import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createServer } from 'vite'

let server
let NotificationsPage
let siteVisitApi

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', define: { 'import.meta.env.VITE_API_MODE': JSON.stringify('live') } })
  NotificationsPage = (await server.ssrLoadModule('/src/features/notifications/NotificationsPage.tsx')).default
  siteVisitApi = await server.ssrLoadModule('/src/features/site-visits/api.ts')
})
after(() => server.close())

function renderNotifications(items) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['notifications', { page: 1 }], { items, page: 1, pageSize: 15, total: items.length })
  client.setQueryData(['projects'], [])
  try {
    return renderToStaticMarkup(h(QueryClientProvider, { client }, h(MemoryRouter, null, h(NotificationsPage))))
  } finally { client.clear() }
}

const base = { id: 'n1', employeeId: 'e1', entityType: 'X', entityId: 'x', createdAt: '2026-09-26T10:00:00Z' }

test('lock-related notification types get sensible labels; unknown types do not crash', () => {
  const html = renderNotifications([
    { ...base, id: '1', eventType: 'PROPERTY_LOCKED', message: 'Another employee\'s customer is interested in a plot you are holding' },
    { ...base, id: '2', eventType: 'LEAD_LOCKED', message: 'Another employee logged a site visit for your locked lead' },
    { ...base, id: '3', eventType: 'PROPERTY_LOCK_RELEASED', message: 'A plot you were waiting for is available again.' },
    { ...base, id: '4', eventType: 'BRAND_NEW_TYPE', message: 'Something new' },
    { ...base, id: '5', eventType: undefined, message: undefined },
    { ...base, id: '6', eventType: 'constructor', message: 'x' },
  ])
  assert.match(html, /Plot interest/)
  assert.match(html, /Lead visited/)
  assert.match(html, /Plot available/)
  assert.match(html, /Log a site visit to reserve it/)
  assert.match(html, /Something new/)
  assert.equal((html.match(/Log a site visit to reserve it/g) ?? []).length, 1)
})

test('create response flags are parsed; retries and missing flags default to normal flow', async () => {
  const realFetch = globalThis.fetch
  const respond = (data) => { globalThis.fetch = async () => new Response(JSON.stringify({ success: true, data }), { status: 200, headers: { 'content-type': 'application/json' } }) }
  const input = { visitorName: 'A', phone: '9000000000', projectId: 'p', visitAt: '2026-09-26T10:00:00+05:30', idempotencyKey: 'k' }
  const visit = { id: 'v', employee_id: 'e', lead_id: 'l', project_id: 'p', visit_at: '2026-09-26T10:00:00Z', created_at: '2026-09-26T10:00:00Z' }
  try {
    respond({ ...visit, opportunity: null, waitlisted: true, lead_held: false, held_until: '2026-09-29T10:00:00Z' })
    let r = await siteVisitApi.createSiteVisit(input)
    assert.equal(r.waitlisted, true); assert.equal(r.leadHeld, false); assert.equal(r.heldUntil, '2026-09-29T10:00:00Z'); assert.equal(r.opportunity, undefined)
    respond({ ...visit, opportunity: null, waitlisted: false, lead_held: true, held_until: '2026-09-29T10:00:00Z' })
    r = await siteVisitApi.createSiteVisit(input)
    assert.equal(r.leadHeld, true); assert.equal(r.waitlisted, false)
    respond({ ...visit })
    r = await siteVisitApi.createSiteVisit(input)
    assert.equal(r.waitlisted, false); assert.equal(r.leadHeld, false); assert.equal(r.heldUntil, null)
  } catch (e) {
    globalThis.fetch = realFetch
    throw e
  }
  globalThis.fetch = realFetch
})
