import { apiFetch } from '@/lib/api/client'
import { liveFetch } from '@/lib/api/liveClient'
import { API_MODE } from '@/lib/apiMode'
import { useAuthStore } from '@/features/auth/store'
import { initialsFromName } from '@/lib/initials'
import type { Employee } from '@/lib/types/domain'

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  employee: Employee
}

interface LiveEmployeeRaw {
  id: string
  employee_code?: string
  name: string
  email: string
  phone?: string
  team?: string
  designation?: string
  status: 'ACTIVE' | 'INACTIVE'
  weekly_day_off_allowance?: number
  business_timezone?: string
}

function adaptLiveEmployee(raw: LiveEmployeeRaw): Employee {
  return {
    id: raw.id,
    employeeCode: raw.employee_code,
    name: raw.name,
    email: raw.email,
    phone: raw.phone,
    team: raw.team,
    designation: raw.designation,
    status: raw.status,
    avatarInitials: initialsFromName(raw.name),
    weeklyDayOffAllowance: raw.weekly_day_off_allowance,
    businessTimezone: raw.business_timezone,
  }
}

async function loginMock(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: { email, password }, skipAuth: true })
}

async function loginLive(email: string, password: string): Promise<LoginResponse> {
  const tokens = await liveFetch<{ access_token: string; refresh_token: string }>('/auth/login', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  })
  // The live API returns tokens only — fetch the profile as a second call, using the
  // fresh access token directly (the auth store isn't populated yet at this point).
  useAuthStore.getState().setAccessToken(tokens.access_token)
  const raw = await liveFetch<LiveEmployeeRaw>('/auth/me')
  return { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, employee: adaptLiveEmployee(raw) }
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return API_MODE === 'live' ? loginLive(email, password) : loginMock(email, password)
}

export async function fetchMe(): Promise<Employee> {
  if (API_MODE === 'live') return adaptLiveEmployee(await liveFetch<LiveEmployeeRaw>('/auth/me'))
  return apiFetch<Employee>('/auth/me')
}

export function logout(): Promise<{ ok: boolean }> {
  if (API_MODE === 'live') {
    const refreshToken = useAuthStore.getState().refreshToken
    return liveFetch<{ ok: boolean }>('/auth/logout', { method: 'POST', body: { refresh_token: refreshToken } })
  }
  return apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' })
}

/** Exchanges the persisted refresh token for a fresh access token during app bootstrap. */
export async function restoreSession(): Promise<Employee | null> {
  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return null
  try {
    if (API_MODE === 'live') {
      const tokens = await liveFetch<{ access_token: string; refresh_token: string }>('/auth/refresh', {
        method: 'POST',
        body: { refresh_token: refreshToken },
        skipAuth: true,
      })
      useAuthStore.getState().setTokens(tokens.access_token, tokens.refresh_token)
      return await fetchMe()
    }
    const { accessToken } = await apiFetch<{ accessToken: string }>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
      skipAuth: true,
    })
    useAuthStore.getState().setAccessToken(accessToken)
    return await fetchMe()
  } catch {
    return null
  }
}
