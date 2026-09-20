import { create } from 'zustand'
import { AUTH_STORAGE_KEY } from '@/lib/constants'
import type { Employee } from '@/lib/types/domain'

export type SessionStatus = 'idle' | 'restoring' | 'authenticated' | 'unauthenticated'

interface PersistedAuth {
  refreshToken: string
  employee: Employee
}

interface AuthState {
  status: SessionStatus
  employee: Employee | null
  accessToken: string | null
  refreshToken: string | null
  setAccessToken: (token: string) => void
  setTokens: (accessToken: string, refreshToken: string) => void
  signIn: (params: { accessToken: string; refreshToken: string; employee: Employee }) => void
  signOutLocally: () => void
  hydrateFromStorage: () => PersistedAuth | null
  confirmRestored: (employee: Employee) => void
}

function readPersisted(): PersistedAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedAuth
  } catch {
    return null
  }
}

function writePersisted(data: PersistedAuth | null) {
  try {
    if (data) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data))
    else localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // best-effort only
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'idle',
  employee: null,
  accessToken: null,
  refreshToken: null,

  setAccessToken: (token) => set({ accessToken: token }),

  setTokens: (accessToken, refreshToken) => {
    // Refresh tokens rotate on every use (live API) — keep the persisted copy in sync
    // so the next refresh doesn't replay a revoked token.
    const employee = get().employee
    if (employee) writePersisted({ refreshToken, employee })
    set({ accessToken, refreshToken })
  },

  signIn: ({ accessToken, refreshToken, employee }) => {
    writePersisted({ refreshToken, employee })
    set({ accessToken, refreshToken, employee, status: 'authenticated' })
  },

  signOutLocally: () => {
    writePersisted(null)
    set({ accessToken: null, refreshToken: null, employee: null, status: 'unauthenticated' })
  },

  hydrateFromStorage: () => {
    const persisted = readPersisted()
    if (persisted) {
      set({ refreshToken: persisted.refreshToken, employee: persisted.employee, status: 'restoring' })
    } else {
      set({ status: 'unauthenticated' })
    }
    return persisted
  },

  confirmRestored: (employee) => {
    set({ employee, status: 'authenticated' })
  },
}))
