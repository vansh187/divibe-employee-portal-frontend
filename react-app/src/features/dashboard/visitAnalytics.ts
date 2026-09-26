import { fetchSiteVisits } from '@/features/site-visits/api'

export interface BarDatum {
  label: string
  sublabel?: string
  count: number
  isCurrent?: boolean
}

export interface VisitAnalytics {
  thisWeekDaily: BarDatum[]
  weekly: BarDatum[]
  thisWeekTotal: number
  lastWeekTotal: number
  eightWeekTotal: number
}

const WEEKS = 8
const PAGE_SIZE = 50
const MAX_PAGES = 20 // 1,000 visits — far beyond 8 weeks of activity for one employee

// Local-time helpers: the API returns instants, but "which day/week" is the employee's local calendar.
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function startOfWeekMonday(d: Date): Date {
  const day = startOfDay(d)
  const offset = (day.getDay() + 6) % 7 // Mon=0 … Sun=6
  day.setDate(day.getDate() - offset)
  return day
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d)
  next.setDate(next.getDate() + n)
  return next
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

/** Buckets visit timestamps into this week's days and the last 8 weeks. Pure, so it is easy to test. */
export function buildVisitAnalytics(visitDates: string[], now: Date = new Date()): VisitAnalytics {
  const thisMonday = startOfWeekMonday(now)
  const today = startOfDay(now)

  const perDay = new Map<string, number>()
  const perWeek = new Map<string, number>()
  for (const iso of visitDates) {
    const d = new Date(iso)
    // Only visits that have happened: the visit form accepts future dates, and scheduled ones aren't activity yet.
    if (Number.isNaN(d.getTime()) || d.getTime() > now.getTime()) continue
    perDay.set(dayKey(d), (perDay.get(dayKey(d)) ?? 0) + 1)
    const wk = dayKey(startOfWeekMonday(d))
    perWeek.set(wk, (perWeek.get(wk) ?? 0) + 1)
  }

  const thisWeekDaily: BarDatum[] = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(thisMonday, i)
    return {
      label: day.toLocaleDateString('en-IN', { weekday: 'short' }),
      sublabel: String(day.getDate()),
      count: perDay.get(dayKey(day)) ?? 0,
      isCurrent: dayKey(day) === dayKey(today),
    }
  })

  const weekly: BarDatum[] = Array.from({ length: WEEKS }, (_, i) => {
    const monday = addDays(thisMonday, -7 * (WEEKS - 1 - i))
    return {
      label: monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      count: perWeek.get(dayKey(monday)) ?? 0,
      isCurrent: i === WEEKS - 1,
    }
  })

  return {
    thisWeekDaily,
    weekly,
    thisWeekTotal: weekly[WEEKS - 1].count,
    lastWeekTotal: weekly[WEEKS - 2].count,
    eightWeekTotal: weekly.reduce((sum, w) => sum + w.count, 0),
  }
}

/**
 * Pulls the employee's visits for the chart. The API's sort order isn't guaranteed, so this never
 * stops early on a date: it reads page 1, then the remaining pages in parallel (capped).
 */
export async function fetchVisitAnalytics(): Promise<VisitAnalytics> {
  const first = await fetchSiteVisits({ page: 1, pageSize: PAGE_SIZE })
  const dates = first.items.map((v) => v.visitAt)
  const totalPages = Math.min(MAX_PAGES, Math.ceil(first.total / PAGE_SIZE))
  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) => fetchSiteVisits({ page: i + 2, pageSize: PAGE_SIZE })),
    )
    for (const res of rest) dates.push(...res.items.map((v) => v.visitAt))
  }
  return buildVisitAnalytics(dates)
}
