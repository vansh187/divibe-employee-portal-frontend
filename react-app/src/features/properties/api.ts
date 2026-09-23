import { apiFetch } from '@/lib/api/client'
import { liveFetch } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import type { Project, PropertyAvailability, PropertyUnit } from '@/lib/types/domain'

// The guide documents the routes (`/properties/projects`, `/properties/projects/{id}/plots`)
// but not their exact JSON field names. These adapters assume the same naming convention
// used elsewhere in the guide (snake_case ids, `plot_no`, `status`) — confirm against the
// real response once the base URL is live and adjust field names here if they differ.
interface LiveProjectRaw {
  id: string
  name: string
  location: string
  phase?: string
}

interface LivePlotRaw {
  id: string
  project_id: string
  plot_no: string
  area_sqft?: number
  status: PropertyAvailability
}

function adaptLiveProject(raw: LiveProjectRaw): Project {
  return { id: raw.id, name: raw.name, location: raw.location, phase: raw.phase }
}

function adaptLivePlot(raw: LivePlotRaw): PropertyUnit {
  return { id: raw.id, projectId: raw.project_id, code: raw.plot_no, areaSqft: raw.area_sqft, availability: raw.status }
}

export function fetchProjects(): Promise<Project[]> {
  if (API_MODE === 'live') {
    return liveFetch<LiveProjectRaw[]>('/properties/projects').then((list) => list.map(adaptLiveProject))
  }
  return apiFetch<Project[]>('/projects')
}

export function fetchProperties(projectId: string): Promise<PropertyUnit[]> {
  if (API_MODE === 'live') {
    return liveFetch<LivePlotRaw[]>(`/properties/projects/${projectId}/plots`).then((list) => list.map(adaptLivePlot))
  }
  return apiFetch<PropertyUnit[]>(`/projects/${projectId}/properties`)
}
