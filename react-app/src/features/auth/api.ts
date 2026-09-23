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

export interface SignupInput {
  name: string
  email: string
  employeeId: string
  password: string
}

export interface SignupStartResult {
  email: string
  /** Mock mode only — the real backend emails the OTP instead of returning it. */
  devOtp?: string
}

// NOTE: signup + email-OTP verification aren't documented in the live API guide
// yet (it only covers /auth/login, /refresh, /logout, /me). These live calls
// assume the same snake_case + { success, data } envelope used everywhere else
// in the guide — confirm the exact routes/fields with the backend team once
// they're built, and adjust here if they differ.
async function signupLive(input: SignupInput): Promise<SignupStartResult> {
  const data = await liveFetch<{ email: string }>('/auth/signup', {
    method: 'POST',
    skipAuth: true,
    body: { name: input.name, email: input.email, employee_id: input.employeeId, password: input.password },
  })
  return { email: data.email }
}

async function signupMock(input: SignupInput): Promise<SignupStartResult> {
  return apiFetch<SignupStartResult>('/auth/signup', { method: 'POST', body: input, skipAuth: true })
}

export function signup(input: SignupInput): Promise<SignupStartResult> {
  return API_MODE === 'live' ? signupLive(input) : signupMock(input)
}

export interface VerifySignupOtpInput {
  email: string
  otp: string
}

/** Verifies the emailed code and activates the account. Does not sign the user in — they log in afterwards. */
export async function verifySignupOtp(input: VerifySignupOtpInput): Promise<void> {
  if (API_MODE === 'live') {
    await liveFetch<unknown>('/auth/signup/verify-otp', {
      method: 'POST',
      skipAuth: true,
      body: { email: input.email, otp: input.otp },
    })
    return
  }
  await apiFetch<LoginResponse>('/auth/signup/verify-otp', { method: 'POST', body: input, skipAuth: true })
}

export function resendSignupOtp(email: string): Promise<SignupStartResult> {
  if (API_MODE === 'live') {
    return liveFetch<{ email: string }>('/auth/signup/resend-otp', { method: 'POST', skipAuth: true, body: { email } })
  }
  return apiFetch<SignupStartResult>('/auth/signup/resend-otp', { method: 'POST', body: { email }, skipAuth: true })
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
