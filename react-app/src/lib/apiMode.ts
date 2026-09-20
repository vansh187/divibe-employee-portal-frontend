/**
 * Toggles the whole app between the in-browser mock backend (MSW) and the
 * real Divine Vision Employee Portal API. Set via .env.local:
 *   VITE_API_MODE=live
 *   VITE_API_BASE_URL=<real base url>
 * Defaults to "mock" so nothing changes until a real base URL is supplied.
 */
export const API_MODE: 'mock' | 'live' = import.meta.env.VITE_API_MODE === 'live' ? 'live' : 'mock'

export const LIVE_API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'
