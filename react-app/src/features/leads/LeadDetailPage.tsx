import { useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLeadDetail, addFollowUp } from '@/features/leads/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { PageLoading, InlineError, EmptyState } from '@/components/ui/States'
import { formatDateTime, formatRemaining } from '@/lib/format'
import { ApiError } from '@/lib/api/client'
import type { FollowUpAction } from '@/lib/types/domain'

// Only these three renew the 3-day lock (spec §5) — a plain NOTE does not.
const FOLLOW_UP_OPTIONS: { value: FollowUpAction['actionType']; label: string; qualifying: boolean }[] = [
  { value: 'CALL_LOGGED', label: 'Logged follow-up call', qualifying: true },
  { value: 'NEXT_VISIT_SCHEDULED', label: 'Scheduled next visit', qualifying: true },
  { value: 'PROPOSAL_SENT', label: 'Proposal/quotation sent', qualifying: true },
  { value: 'NOTE', label: 'Note (does not extend your hold)', qualifying: false },
]

export default function LeadDetailPage() {
  const { leadId = '' } = useParams()
  const location = useLocation()
  const justLogged = (location.state as { justLogged?: boolean } | null)?.justLogged
  const queryClient = useQueryClient()
  const [actionType, setActionType] = useState<FollowUpAction['actionType']>('CALL_LOGGED')
  const isQualifyingAction = FOLLOW_UP_OPTIONS.find((o) => o.value === actionType)?.qualifying ?? false

  const { data, isLoading, error } = useQuery({
    queryKey: ['lead', leadId],
    queryFn: () => fetchLeadDetail(leadId),
  })

  const mutation = useMutation({
    mutationFn: () => addFollowUp(leadId, { actionType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (isLoading) return <PageLoading label="Loading lead…" />
  if (error) return <InlineError message={error instanceof ApiError ? error.message : 'Failed to load this lead.'} />
  if (!data) return null

  const { lead, visits, followUps, activeLock, opportunity } = data

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={lead.name}
        subtitle={`${lead.phone}${lead.email ? ` · ${lead.email}` : ''}`}
        actions={
          <Link to={`/site-visits/new`}>
            <Button size="sm">+ Log Another Visit</Button>
          </Link>
        }
      />

      {justLogged && (
        <div className="mb-5 rounded-md border border-status-success/30 bg-status-success-bg px-4 py-3 text-sm text-status-success">
          Site visit logged successfully.
        </div>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Lead &amp; Property Lock</p>
          {activeLock ? (
            <div className="mt-2 flex items-center justify-between">
              <span className="text-sm text-ink-900">Locked to you</span>
              <Badge tone="warning">{formatRemaining(activeLock.expiresAt)}</Badge>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-500">No active protection on this lead.</p>
          )}
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Opportunity</p>
          {opportunity ? (
            <div className="mt-2 flex flex-col gap-1 text-sm">
              <span className="text-ink-900">
                Source: <span className="font-semibold">{opportunity.sourceOwnerType.replace('_', ' ')}</span>
              </span>
              <span className="text-ink-500">Status: {opportunity.status.replace('_', ' ')}</span>
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-500">No opportunity recorded yet.</p>
          )}
        </Card>
      </div>

      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base text-ink-900">Log a follow-up</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Select
              label="Action"
              value={actionType}
              onChange={(e) => setActionType(e.target.value as FollowUpAction['actionType'])}
            >
              {FOLLOW_UP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          <Button onClick={() => mutation.mutate()} isLoading={mutation.isPending}>
            {isQualifyingAction ? 'Log & Renew Protection' : 'Log Note'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-ink-500">
          Only calls, scheduled visits, and proposals extend your hold on this lead.
        </p>
        {mutation.isError && (
          <div className="mt-3">
            <InlineError message={mutation.error instanceof ApiError ? mutation.error.message : 'Failed to log follow-up.'} />
          </div>
        )}
      </Card>

      <Card className="mb-6">
        <h2 className="mb-4 font-display text-base text-ink-900">Timeline</h2>
        {visits.length === 0 && followUps.length === 0 && (
          <EmptyState title="No activity yet" description="Visits and follow-ups will appear here." />
        )}
        <ul className="flex flex-col gap-4">
          {[...visits.map((v) => ({ type: 'visit' as const, at: v.visitAt, data: v })), ...followUps.map((f) => ({ type: 'followup' as const, at: f.loggedAt, data: f }))]
            .sort((a, b) => b.at.localeCompare(a.at))
            .map((item) => (
              <li key={`${item.type}-${item.data.id}`} className="border-l-2 border-gold-400 pl-4">
                <p className="text-xs text-ink-500">{formatDateTime(item.at)}</p>
                {item.type === 'visit' ? (
                  <p className="text-sm text-ink-900">
                    Site visit logged{item.data.outcome ? ` — ${item.data.outcome.replace(/_/g, ' ')}` : ''}
                    {item.data.notes && <span className="block text-ink-500">{item.data.notes}</span>}
                  </p>
                ) : (
                  <p className="text-sm text-ink-900">
                    {FOLLOW_UP_OPTIONS.find((o) => o.value === item.data.actionType)?.label ?? item.data.actionType}
                  </p>
                )}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  )
}
