import { useState } from 'react'
import { useParams, Link, useLocation } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchLeadDetail, addFollowUp, updateOpportunityStatus } from '@/features/leads/api'
import type { SettableOpportunityStatus } from '@/features/leads/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { PageLoading, InlineError, EmptyState } from '@/components/ui/States'
import { WidgetBoundary } from '@/components/errors/WidgetBoundary'
import { formatDateTime, formatRemaining } from '@/lib/format'
import { ApiError } from '@/lib/api/client'
import type { FollowUpAction, Opportunity, OpportunityStatus } from '@/lib/types/domain'

// Only these three renew the 3-day lock (spec §5) — a plain NOTE does not.
const FOLLOW_UP_OPTIONS: { value: FollowUpAction['actionType']; label: string; qualifying: boolean }[] = [
  { value: 'CALL_LOGGED', label: 'Logged follow-up call', qualifying: true },
  { value: 'NEXT_VISIT_SCHEDULED', label: 'Scheduled next visit', qualifying: true },
  { value: 'PROPOSAL_SENT', label: 'Proposal/quotation sent', qualifying: true },
  { value: 'NOTE', label: 'Note (does not extend your hold)', qualifying: false },
]

// Full set, for the read-only status badge (ACTIVE/EXPIRED/ATTRIBUTION_CONFLICT
// are backend-derived and can't be set by the employee).
const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  ACTIVE: 'In Progress',
  DEAL_IN_PROGRESS: 'Deal In Progress',
  CONVERTED: 'Deal Complete',
  DEAL_REJECTED: 'Deal Rejected',
  LOST: 'Lost',
  EXPIRED: 'Expired',
  RELEASED: 'Released',
  ATTRIBUTION_CONFLICT: 'Attribution Conflict',
}

// Only these are settable via POST /opportunities/{id}/status, and only when
// the opportunity is currently ACTIVE or DEAL_IN_PROGRESS. The current status
// is excluded from the choices in the card.
const SETTABLE_STATUS_OPTIONS: { value: SettableOpportunityStatus; label: string }[] = [
  { value: 'DEAL_IN_PROGRESS', label: 'Deal In Progress' },
  { value: 'CONVERTED', label: 'Deal Complete' },
  { value: 'DEAL_REJECTED', label: 'Deal Rejected' },
  { value: 'LOST', label: 'Lost' },
  { value: 'RELEASED', label: 'Release Lock' },
]

function getStatusBadgeTone(status: OpportunityStatus): 'success' | 'warning' | 'danger' | 'info' {
  switch (status) {
    case 'ACTIVE':
    case 'DEAL_IN_PROGRESS':
      return 'info'
    case 'CONVERTED':
      return 'success'
    case 'LOST':
    case 'DEAL_REJECTED':
    case 'EXPIRED':
      return 'danger'
    default:
      return 'warning'
  }
}

interface OpportunityCardProps {
  opportunity: Opportunity
  onSubmitStatus: (opportunityId: string, status: SettableOpportunityStatus) => void
  isLoading?: boolean
  justUpdated?: boolean
  failureMessage?: string | null
}

function OpportunityCard({ opportunity, onSubmitStatus, isLoading, justUpdated, failureMessage }: OpportunityCardProps) {
  const [pickedStatus, setPickedStatus] = useState<SettableOpportunityStatus | null>(null)
  const statusOptions = SETTABLE_STATUS_OPTIONS.filter((o) => o.value !== opportunity.status)
  const selectedStatus =
    statusOptions.find((o) => o.value === pickedStatus)?.value ?? statusOptions[0].value
  const canChangeStatus = opportunity.status === 'ACTIVE' || opportunity.status === 'DEAL_IN_PROGRESS'

  return (
    <div className="rounded-md border border-forest-800/10 bg-forest-800/2 p-3">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Source</p>
            <p className="mt-1 text-ink-900">{opportunity.sourceOwnerType.replace('_', ' ')}</p>
          </div>
          <Badge tone={getStatusBadgeTone(opportunity.status)}>{OPPORTUNITY_STATUS_LABELS[opportunity.status]}</Badge>
        </div>

        {canChangeStatus ? (
          <div className="border-t border-forest-800/10 pt-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-ink-500">Change Status</label>
            <div className="mt-2 flex items-center gap-2">
              <Select
                value={selectedStatus}
                onChange={(e) => setPickedStatus(e.target.value as SettableOpportunityStatus)}
                disabled={isLoading}
              >
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={() => onSubmitStatus(opportunity.id, selectedStatus)} isLoading={isLoading}>
                Submit
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t border-forest-800/10 pt-3 text-xs text-ink-500">
            This opportunity is {OPPORTUNITY_STATUS_LABELS[opportunity.status].toLowerCase()} and can no longer be changed.
          </p>
        )}

        {justUpdated && (
          <div className="rounded-md border border-status-success/30 bg-status-success-bg px-3 py-2 text-xs text-status-success">
            Deal updated — status is now <span className="font-semibold">{OPPORTUNITY_STATUS_LABELS[opportunity.status]}</span>.
          </div>
        )}

        {failureMessage && (
          <div className="rounded-md border border-status-danger/30 bg-status-danger-bg px-3 py-2 text-xs text-status-danger">
            {failureMessage}
          </div>
        )}
      </div>
    </div>
  )
}

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

  const [pendingOpportunityId, setPendingOpportunityId] = useState<string | null>(null)
  const [justUpdatedOpportunityId, setJustUpdatedOpportunityId] = useState<string | null>(null)
  const [failedOpportunity, setFailedOpportunity] = useState<{ id: string; message: string } | null>(null)

  const statusMutation = useMutation({
    mutationFn: (payload: { opportunityId: string; status: SettableOpportunityStatus }) => {
      return updateOpportunityStatus(payload.opportunityId, payload.status)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setJustUpdatedOpportunityId(variables.opportunityId)
    },
    onError: (mutationError, variables) => {
      const message = mutationError instanceof ApiError ? mutationError.message : 'Failed to update status. Please try again.'
      setFailedOpportunity({ id: variables.opportunityId, message })
    },
    onSettled: () => {
      setPendingOpportunityId(null)
    },
  })

  const handleSubmitStatus = (opportunityId: string, status: SettableOpportunityStatus) => {
    setJustUpdatedOpportunityId(null)
    setFailedOpportunity(null)
    setPendingOpportunityId(opportunityId)
    statusMutation.mutate({ opportunityId, status })
  }

  if (isLoading) return <PageLoading label="Loading lead…" />
  if (error) return <InlineError message={error instanceof ApiError ? error.message : 'Failed to load this lead.'} />
  if (!data) return null

  const { lead, visits, followUps, activeLock, opportunities } = data

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
        <WidgetBoundary label="Lead & Property Lock">
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
        </WidgetBoundary>

        <WidgetBoundary label="Opportunities">
          <Card>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Opportunities</p>
            {opportunities.length === 0 ? (
              <p className="mt-2 text-sm text-ink-500">No opportunities recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-4">
                {opportunities.map((opp) => (
                  <OpportunityCard
                    key={opp.id}
                    opportunity={opp}
                    onSubmitStatus={handleSubmitStatus}
                    isLoading={pendingOpportunityId === opp.id}
                    justUpdated={justUpdatedOpportunityId === opp.id}
                    failureMessage={failedOpportunity?.id === opp.id ? failedOpportunity.message : null}
                  />
                ))}
              </div>
            )}
          </Card>
        </WidgetBoundary>
      </div>

      <WidgetBoundary label="Log Follow-up">
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
      </WidgetBoundary>

      <WidgetBoundary label="Timeline">
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
      </WidgetBoundary>
    </div>
  )
}
