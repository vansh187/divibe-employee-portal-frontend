import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/app/App'
import { API_MODE } from '@/lib/apiMode'

async function prepare() {
  // VITE_API_MODE=live points the app at the real backend (see .env.example) and
  // skips the mock worker entirely. Defaults to "mock" until a base URL is set.
  if (API_MODE !== 'mock') return
  try {
    const { worker } = await import('@/lib/mock/browser')
    await worker.start({
      onUnhandledRequest: 'bypass',
      serviceWorker: { url: '/mockServiceWorker.js' },
    })
  } catch (err) {
    // Don't block the whole app from rendering if the mock worker can't start —
    // pages will surface their own errors via the fetch calls instead.
    console.error('Mock API worker failed to start', err)
  }
}

prepare().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
