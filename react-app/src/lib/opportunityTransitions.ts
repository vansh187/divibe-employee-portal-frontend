// Single source of truth for the forward-only opportunity flow
// (NEW -> INTERESTED -> DEAL_IN_PROGRESS -> Deal Complete / Deal Rejected).
// Lost and Release Lock have no rank: allowed from any open status.
// The backend enforces this too (409 INVALID_STATUS_TRANSITION); the UI hides
// backward options and the mock API mirrors the same rule.
export const OPEN_STATUSES: readonly string[] = ['NEW', 'ACTIVE', 'INTERESTED', 'DEAL_IN_PROGRESS']

const STAGE_RANK: Record<string, number> = { NEW: 0, ACTIVE: 0, INTERESTED: 1, DEAL_IN_PROGRESS: 2 }

export function isAllowedTransition(from: string, to: string): boolean {
  if (from === to || !OPEN_STATUSES.includes(from)) return false
  const target = STAGE_RANK[to]
  return target === undefined || target > (STAGE_RANK[from] ?? -1)
}
