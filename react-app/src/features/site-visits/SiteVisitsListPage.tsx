import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSiteVisits, type SiteVisitWithRefs } from '@/features/site-visits/api'
import { updateOpportunityStatus, type SettableOpportunityStatus } from '@/features/leads/api'
import { OpportunityCard } from '@/features/leads/OpportunityCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonBlock, EmptyState, InlineError } from '@/components/ui/States'
import { formatDateTime } from '@/lib/format'
import { ApiError } from '@/lib/api/client'

const OUTCOME_TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  INTERESTED: 'success',
  PROPOSAL_REQUESTED: 'success',
  FOLLOW_UP_REQUIRED: 'warning',
  NOT_INTERESTED: 'danger',
  NO_SHOW: 'danger',
}

function VisitOpportunity({ visit }: { visit: SiteVisitWithRefs }) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SettableOpportunityStatus }) => updateOpportunityStatus(id, status),
    onSettled: () => {
      // A repeat visit can share its opportunity with other rows and the lead page.
      for (const queryKey of [['site-visits'], ['lead', visit.leadId], ['leads'], ['dashboard'], ['properties']]) {
        queryClient.invalidateQueries({ queryKey })
      }
    },
  })

  if (!visit.opportunity) return (
    <p className="text-sm text-ink-500">Opportunity unavailable for this visit. <Link className="underline" to={`/leads/${visit.leadId}`}>View lead</Link></p>
  )

  return <OpportunityCard
    opportunity={visit.opportunity}
    canUpdate={visit.canUpdateOpportunity ?? false}
    onSubmitStatus={(id, status) => mutation.mutate({ id, status })}
    isLoading={mutation.isPending}
    justUpdated={mutation.isSuccess}
    failureMessage={mutation.isError ? (mutation.error instanceof ApiError ? mutation.error.message : 'Unable to update this opportunity. Please try again.') : null}
  />
}

export default function SiteVisitsListPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error } = useQuery({
    queryKey: ['site-visits', { page, pageSize: 10 }],
    queryFn: () => fetchSiteVisits({ page, pageSize: 10 }),
  })

  return (
    <div>
      <PageHeader
        title="Site Visits"
        subtitle="View each visit’s opportunity and update its status."
        actions={
          <Link to="/site-visits/new">
            <Button size="sm">+ Log Visit</Button>
          </Link>
        }
      />

      <Card>
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-16" />
            ))}
          </div>
        )}

        {error && <InlineError message={error instanceof ApiError ? error.message : 'Failed to load site visits.'} />}

        {!isLoading && !error && data && data.items.length === 0 && (
          <EmptyState
            title="No site visits yet"
            description="Log your first visit to start building your leads pipeline."
            action={
              <Link to="/site-visits/new">
                <Button size="sm">+ Log Visit</Button>
              </Link>
            }
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <ul className="flex flex-col divide-y divide-forest-800/8">
            {data.items.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link to={`/leads/${v.leadId}`} className="text-sm font-semibold text-ink-900 hover:underline">
                    {v.visitorName ?? v.lead?.name ?? 'Unknown lead'}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {v.project?.name} {v.property ? `· ${v.property.code}` : ''} · {formatDateTime(v.visitAt)}
                  </p>
                </div>
                {v.outcome && <Badge tone={OUTCOME_TONE[v.outcome] ?? 'neutral'}>{v.outcome.replace(/_/g, ' ')}</Badge>}
                <div className="w-full">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Opportunity</p>
                  <VisitOpportunity visit={v} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  )
}
