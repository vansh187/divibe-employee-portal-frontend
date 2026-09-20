import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { fetchProjects } from '@/features/properties/api'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { SkeletonBlock, InlineError } from '@/components/ui/States'
import { ApiError } from '@/lib/api/client'

export default function ProjectsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })

  return (
    <div>
      <PageHeader title="Projects &amp; Properties" subtitle="Browse plot availability across active developments." />

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-28" />
          ))}
        </div>
      )}

      {error && <InlineError message={error instanceof ApiError ? error.message : 'Failed to load projects.'} />}

      {!isLoading && data && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((p) => (
            <Link key={p.id} to={`/properties/${p.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <p className="font-display text-lg text-forest-800">{p.name}</p>
                <p className="mt-1 text-sm text-ink-500">
                  {p.location}
                  {p.phase ? ` · ${p.phase}` : ''}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
