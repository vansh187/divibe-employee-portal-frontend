import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchProjects, fetchProperties } from '@/features/properties/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { WidgetBoundary } from '@/components/errors/WidgetBoundary'
import { OPEN_STATUSES, isAllowedTransition } from '@/lib/opportunityTransitions'
import { Select } from '@/components/ui/Select'
import type { Opportunity, OpportunityStatus } from '@/lib/types/domain'
import type { SettableOpportunityStatus } from '@/features/leads/api'

// Full set, for the read-only status badge (ACTIVE/EXPIRED/ATTRIBUTION_CONFLICT
// are backend-derived and can't be set by the employee).
const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  NEW: 'New',
  ACTIVE: 'New', // legacy — treated like NEW
  INTERESTED: 'Interested',
  DEAL_IN_PROGRESS: 'Deal In Progress',
  CONVERTED: 'Deal Complete',
  DEAL_REJECTED: 'Deal Rejected',
  LOST: 'Lost',
  EXPIRED: 'Expired',
  RELEASED: 'Released',
  ATTRIBUTION_CONFLICT: 'Under review',
}

// Only these are settable via POST /opportunities/{id}/status, and only when
// the opportunity is currently NEW, ACTIVE, INTERESTED or DEAL_IN_PROGRESS. The current status
// is excluded from the choices in the card.
const SETTABLE_STATUS_OPTIONS: { value: SettableOpportunityStatus; label: string }[] = [
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'DEAL_IN_PROGRESS', label: 'Deal In Progress' },
  { value: 'CONVERTED', label: 'Deal Complete' },
  { value: 'DEAL_REJECTED', label: 'Deal Rejected' },
  { value: 'LOST', label: 'Lost' },
  { value: 'RELEASED', label: 'Release Lock' },
]

// Never throws on a status this build doesn't know: falls back to the raw text.
function getStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Unknown status'
  return (OPPORTUNITY_STATUS_LABELS as Record<string, string | undefined>)[status] ?? status
}

function getStatusBadgeTone(status: string | null | undefined): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  switch (status) {
    case 'NEW':
    case 'ACTIVE':
    case 'INTERESTED':
    case 'DEAL_IN_PROGRESS':
      return 'info'
    case 'CONVERTED':
      return 'success'
    case 'LOST':
    case 'DEAL_REJECTED':
    case 'EXPIRED':
      return 'danger'
    case 'RELEASED':
    case 'ATTRIBUTION_CONFLICT':
      return 'warning'
    default:
      return 'neutral'
  }
}

interface OpportunityCardProps {
  opportunity: Opportunity
  onSubmitStatus: (opportunityId: string, status: SettableOpportunityStatus) => void
  isLoading?: boolean
  justUpdated?: boolean
  failureMessage?: string | null
  canUpdate?: boolean
}

function OpportunityCardInner({ opportunity, onSubmitStatus, isLoading, justUpdated, failureMessage, canUpdate = true }: OpportunityCardProps) {
  const [pickedStatus, setPickedStatus] = useState<SettableOpportunityStatus | null>(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])
  // Prefer names embedded by the API; otherwise resolve from the (cached) project/plot lists.
  const needProject = !opportunity.projectName && !!opportunity.projectId
  const needPlot = !opportunity.plotNo && !!opportunity.propertyId && !!opportunity.projectId
  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects, enabled: needProject })
  const { data: plots } = useQuery({
    queryKey: ['properties', opportunity.projectId],
    queryFn: () => fetchProperties(opportunity.projectId),
    enabled: needPlot,
  })
  const projectName = opportunity.projectName ?? projects?.find((p) => p.id === opportunity.projectId)?.name
  const plotNo = opportunity.plotNo ?? plots?.find((p) => p.id === opportunity.propertyId)?.code

  // API values can arrive before the frontend has been updated for a new status.
  const status: string = opportunity.status
  const isKnownStatus = status in OPPORTUNITY_STATUS_LABELS
  const statusLabel = getStatusLabel(status)
  const isOpen = OPEN_STATUSES.includes(status)
  const statusOptions = SETTABLE_STATUS_OPTIONS.filter((o) => isAllowedTransition(status, o.value))
  const selectedStatus = statusOptions.find((o) => o.value === pickedStatus)?.value ?? statusOptions[0]?.value
  const hasExpired = opportunity.expiresAt ? Date.parse(opportunity.expiresAt) <= now : false
  const canChangeStatus = canUpdate && !hasExpired && isOpen && statusOptions.length > 0 && !!selectedStatus

  return (
    <div className="rounded-md border border-forest-800/10 bg-forest-800/2 p-3">
      <div className="flex flex-col gap-3 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Project</p>
            <p className="mt-1 font-medium text-ink-900">{projectName ?? '—'}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Plot</p>
            <p className="mt-1 font-medium text-ink-900">{plotNo ?? (opportunity.propertyId ? '—' : 'Not selected')}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Source</p>
            <p className="mt-1 text-ink-900">{(opportunity.sourceOwnerType ?? '').replace('_', ' ')}</p>
          </div>
          <Badge tone={getStatusBadgeTone(status)}>{statusLabel}</Badge>
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
              <Button size="sm" onClick={() => selectedStatus && onSubmitStatus(opportunity.id, selectedStatus)} isLoading={isLoading}>
                Submit
              </Button>
            </div>
          </div>
        ) : (
          <p className="border-t border-forest-800/10 pt-3 text-xs text-ink-500">
            {hasExpired && isOpen
              ? 'Protection has expired. Log another visit to start a new opportunity.'
              : isKnownStatus
              ? `This opportunity is ${statusLabel.toLowerCase()} and cannot be changed here.`
              : 'Status information is unavailable. Please refresh to get the latest details.'}
          </p>
        )}

        {justUpdated && (
          <div className="rounded-md border border-status-success/30 bg-status-success-bg px-3 py-2 text-xs text-status-success">
            Deal updated — status is now <span className="font-semibold">{statusLabel}</span>.
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


// Per-card boundary so one malformed record can't blank the whole widget.
export function OpportunityCard(props: OpportunityCardProps) {
  return (
    <WidgetBoundary label="Opportunity">
      <OpportunityCardInner {...props} />
    </WidgetBoundary>
  )
}
