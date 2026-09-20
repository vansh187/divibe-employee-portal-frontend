import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchProperties, fetchProjects } from '@/features/properties/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SkeletonBlock, EmptyState, InlineError } from '@/components/ui/States'
import { PROPERTY_AVAILABILITY_LABEL } from '@/lib/constants'
import { ApiError } from '@/lib/api/client'
import type { PropertyAvailability } from '@/lib/types/domain'

const TONE: Record<PropertyAvailability, 'success' | 'warning' | 'danger' | 'neutral'> = {
  AVAILABLE: 'success',
  LOCKED: 'warning',
  DEAL_LOCKED: 'danger',
  SOLD: 'neutral',
}

export default function PropertyListPage() {
  const { projectId = '' } = useParams()

  const { data: projects } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const project = projects?.find((p) => p.id === projectId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['properties', projectId],
    queryFn: () => fetchProperties(projectId),
  })

  return (
    <div>
      <PageHeader
        title={project?.name ?? 'Project'}
        subtitle={project ? `${project.location}${project.phase ? ` · ${project.phase}` : ''}` : undefined}
      />

      <Card>
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-14" />
            ))}
          </div>
        )}

        {error && <InlineError message={error instanceof ApiError ? error.message : 'Failed to load properties.'} />}

        {!isLoading && data && data.length === 0 && <EmptyState title="No plots configured for this project yet." />}

        {!isLoading && data && data.length > 0 && (
          <ul className="flex flex-col divide-y divide-forest-800/8">
            {data.map((unit) => (
              <li key={unit.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-ink-900">{unit.code}</span>
                  {unit.availability === 'AVAILABLE' && (
                    <Link
                      to="/site-visits/new"
                      className="text-xs text-gold-600 hover:underline"
                    >
                      Log visit for this plot
                    </Link>
                  )}
                </div>
                <Badge tone={TONE[unit.availability]}>{PROPERTY_AVAILABILITY_LABEL[unit.availability]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
