import type { ApiErrorBody } from '@/lib/types/domain'
import { useAuthStore } from '@/features/auth/store'

export class ApiError extends Error {
  code: ApiErrorBody['code']
  details?: Record<string, unknown>
  status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.details = body.details
  }
}

const BASE_URL = '/api'

let refreshInFlight: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return null
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as { accessToken: string }
        useAuthStore.getState().setAccessToken(data.accessToken)
        return data.accessToken
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  skipAuth?: boolean
  skipRetry?: boolean
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth, skipRetry, headers, ...rest } = options
  const accessToken = useAuthStore.getState().accessToken

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken && !skipAuth ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !skipAuth && !skipRetry) {
    const newToken = await refreshAccessToken()
    if (newToken) {
      return apiFetch<T>(path, { ...options, skipRetry: true })
    }
    useAuthStore.getState().signOutLocally()
    throw new ApiError(401, { code: 'UNAUTHORIZED', message: 'Your session has expired. Please sign in again.' })
  }

  if (!res.ok) {
    let errorBody: ApiErrorBody
    try {
      errorBody = (await res.json()) as ApiErrorBody
    } catch {
      errorBody = { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.' }
    }
    throw new ApiError(res.status, errorBody)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
