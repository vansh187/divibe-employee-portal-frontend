import type { ApiErrorBody, Paginated } from '@/lib/types/domain'
import { LIVE_API_BASE_URL } from '@/lib/apiMode'
import { useAuthStore } from '@/features/auth/store'
import { ApiError } from '@/lib/api/client'

interface LiveEnvelopeOk<T> {
  success: true
  data: T
  message?: string | null
}

interface LiveEnvelopePaginated<T> {
  success: true
  data: T[]
  pagination: { page: number; page_size: number; total_items: number; total_pages: number }
}

interface LiveEnvelopeErr {
  success: false
  error: { code: string; message: string; fields?: { field: string; message: string }[] }
}

let refreshInFlight: Promise<string | null> | null = null

async function refreshLiveTokens(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return null
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${LIVE_API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null
        const body = (await res.json()) as LiveEnvelopeOk<{ access_token: string; refresh_token: string }>
        // Refresh tokens rotate on every use — persist the new one or the next refresh will 401.
        useAuthStore.getState().setTokens(body.data.access_token, body.data.refresh_token)
        return body.data.access_token
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

interface LiveRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  skipAuth?: boolean
  skipRetry?: boolean
}

async function rawRequest(path: string, options: LiveRequestOptions): Promise<Response> {
  const { body, skipAuth, headers, ...rest } = options
  const accessToken = useAuthStore.getState().accessToken
  return fetch(`${LIVE_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

async function toApiError(res: Response): Promise<ApiError> {
  let body: LiveEnvelopeErr | null = null
  try {
    body = (await res.json()) as LiveEnvelopeErr
  } catch {
    // fall through to generic error below
  }
  if (res.status === 429) {
    return new ApiError(429, {
      code: 'RATE_LIMIT_EXCEEDED',
      message: "You're doing that a bit too fast — please wait a moment and try again.",
    })
  }
  const errBody: ApiErrorBody = body?.success === false
    ? { code: body.error.code, message: body.error.message, fields: body.error.fields }
    : { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' }
  return new ApiError(res.status, errBody)
}

/** Single-object / action-result endpoints — unwraps `{ success, data }`. */
export async function liveFetch<T>(path: string, options: LiveRequestOptions = {}): Promise<T> {
  const res = await rawRequest(path, options)

  if (res.status === 401 && !options.skipAuth && !options.skipRetry) {
    const newToken = await refreshLiveTokens()
    if (newToken) return liveFetch<T>(path, { ...options, skipRetry: true })
    useAuthStore.getState().signOutLocally()
    throw new ApiError(401, { code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' })
  }

  if (!res.ok) throw await toApiError(res)

  const body = (await res.json()) as LiveEnvelopeOk<T>
  return body.data
}

/** Paginated list endpoints — unwraps `{ success, data, pagination }` into our shared `Paginated<T>` shape. */
export async function liveFetchPaginated<T>(path: string, options: LiveRequestOptions = {}): Promise<Paginated<T>> {
  const res = await rawRequest(path, options)

  if (res.status === 401 && !options.skipAuth && !options.skipRetry) {
    const newToken = await refreshLiveTokens()
    if (newToken) return liveFetchPaginated<T>(path, { ...options, skipRetry: true })
    useAuthStore.getState().signOutLocally()
    throw new ApiError(401, { code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' })
  }

  if (!res.ok) throw await toApiError(res)

  const body = (await res.json()) as LiveEnvelopePaginated<T>
  return {
    items: body.data,
    page: body.pagination.page,
    pageSize: body.pagination.page_size,
    total: body.pagination.total_items,
  }
}

export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
