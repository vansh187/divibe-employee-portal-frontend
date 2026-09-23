# Divine Vision — Employee Field Portal (React)

Employee-only site visit portal per the V1.5 frozen spec. Vite + React + TypeScript + Tailwind, running against a mock API (MSW) so the full flow — leads, site visits, lead/property locking, attendance, weekly Day Off — is usable end to end with no backend yet.

## Getting started

```bash
npm install
npm run dev
```

**Demo login** — any password works against the seeded account:

- Email: `rohan.kaushik@divinevisioninfra.com`
- Password: anything

The mock backend persists its state to `localStorage` (`dvi.mockdb.v1`), so data survives reloads within a browser session. Clear that key (or use a private window) to reset to the seed data.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check (`tsc -b`) then production build
- `npm run preview` — serve the production build locally
- `npm run lint` — oxlint

## Architecture notes

- **Mock API → real API**: every feature's `api.ts` (e.g. `src/features/leads/api.ts`) exports plain functions that branch on `API_MODE` (`src/lib/apiMode.ts`) — mock calls go through `src/lib/api/client.ts` (relative `/api/*`, intercepted by MSW), live calls go through `src/lib/api/liveClient.ts` (real base URL, unwraps the `{success,data}`/`{success,data,pagination}`/`{success:false,error}` envelope from the API Integration Guide). UI components only ever import the feature functions and the shared camelCase domain types (`src/lib/types/domain.ts`) — they don't know which mode is active.
- **Switching to the real backend**: copy `.env.example` to `.env.local` and set:
  ```
  VITE_API_MODE=live
  VITE_API_BASE_URL=https://divine-employee-backend.vercel.app/api/v1
  ```
  Nothing else changes — the mock worker doesn't even start in live mode.
- **Error boundaries**: a global boundary in `App.tsx`, a per-route `errorElement` on every route (`src/app/router.tsx`), and per-widget boundaries on the Dashboard (`WidgetBoundary`) so one broken card never blanks the page.
- **Reload-safe routing**: `AuthBootstrap` resolves the session (via the persisted refresh token) behind a loading screen *before* the router renders, so reloading any deep link (e.g. `/leads/42`) restores that exact page instead of 404ing or bouncing to the dashboard. `netlify.toml` / `vercel.json` / `nginx.conf.example` are included so the same holds true once deployed (SPA rewrite to `index.html`).
- **Business rules from the spec** live in `src/lib/mock/handlers.ts` (day-off conflict, lead/property lock, 3-day protection window, qualifying-action renewal) — this is the reference for what a real backend needs to enforce.

### Live-mode assumptions to verify once the base URL is live

The [API Integration Guide](.) is thorough but a few response shapes aren't shown as JSON examples — the live adapters (in each feature's `api.ts`) make a best-effort, clearly-commented assumption for these. Grep for `NOTE:` / the comment above each `Live*Raw` interface to find them. Worth a quick check against real responses:

1. **Lead detail** — there's no combined "lead + visits + follow-ups + lock + opportunity" endpoint documented, only separate list/follow-up endpoints. `features/leads/api.ts` composes what it can (lead + follow-ups + a client-side lookup against `/leads/active-locks`) and leaves `visits: []` / `opportunity: null` in live mode rather than guessing at an undocumented endpoint. If the backend has (or adds) a scoped visits-by-lead endpoint, wire it in there.
2. **`GET /leads`, `GET /leads/{id}`, `GET /properties/projects`, `GET /properties/projects/{id}/plots`, `POST/GET /site-visits`, `GET /attendance/*`, `GET/POST /day-off/*`** — the guide documents routes/request bodies but not response field names for these. Adapters assume the same snake_case convention used elsewhere in the guide (e.g. `plot_no`, `status`, `work_date`). If actual field names differ, it's a one-line fix in that feature's `adaptLive*` function — the rest of the app is unaffected.
3. **Weekly Day Off UX** — the live API freezes on selection (no separate confirm step), unlike the mock's two-step select→freeze. `DayOffCalendarPage` already branches on `API_MODE` for this (a confirm dialog before calling `selectDayOff` in live mode instead of showing a separate "Confirm & Freeze" button).
4. **Opportunities/Deals** — not built as a UI (not in the V1 module list), but `POST /site-visits` in live mode sends `idempotency_key` and the client is ready to consume opportunity data if a future screen needs it.
