import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchLeads } from '@/features/leads/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { SkeletonBlock, EmptyState, InlineError } from '@/components/ui/States'
import { formatDateLong } from '@/lib/format'
import { ApiError } from '@/lib/api/client'

const LIFECYCLE_TONE = {
  NEW: 'info',
  IN_PROGRESS: 'warning',
  CONVERTED: 'success',
  LOST: 'danger',
} as const

export default function LeadsListPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['leads', { page, q: search }],
    queryFn: () => fetchLeads({ page, pageSize: 10, q: search }),
  })

  return (
    <div>
      <PageHeader title="Leads" subtitle="Leads created or updated from your site visits." />

      <div className="mb-4 max-w-sm">
        <Input
          placeholder="Search by name or phone…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
      </div>

      <Card>
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-16" />
            ))}
          </div>
        )}

        {error && <InlineError message={error instanceof ApiError ? error.message : 'Failed to load leads.'} />}

        {!isLoading && !error && data && data.items.length === 0 && (
          <EmptyState title="No leads found" description="Leads are created automatically from your site visits." />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <ul className="flex flex-col divide-y divide-forest-800/8">
            {data.items.map((lead) => (
              <li key={lead.id} className="flex flex-wrap items-center gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <Link to={`/leads/${lead.id}`} className="text-sm font-semibold text-ink-900 hover:underline">
                    {lead.name}
                  </Link>
                  <p className="text-xs text-ink-500">
                    {lead.phone}
                    {lead.latestVisitAt ? ` · last visit ${formatDateLong(lead.latestVisitAt).split(',')[0]}` : ''}
                  </p>
                </div>
                <Badge tone={LIFECYCLE_TONE[lead.lifecycleStatus]}>{lead.lifecycleStatus.replace('_', ' ')}</Badge>
              </li>
            ))}
          </ul>
        )}

        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  )
}
