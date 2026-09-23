/**
 * Toggles the whole app between the in-browser mock backend (MSW) and the
 * real Divine Vision Employee Portal API. Set via .env.local:
 *   VITE_API_MODE=live
 *   VITE_API_BASE_URL=https://divine-employee-backend.vercel.app/api/v1
 * Defaults to "mock" unless live mode is explicitly enabled.
 */
export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'

export const LIVE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'https://divine-employee-backend.vercel.app/api/v1'
