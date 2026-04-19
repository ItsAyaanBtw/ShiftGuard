import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import App from './App.jsx'
import { rehydrateSecureStore } from './lib/accounts'

// Bootstrap the at-rest encryption cache before we mount the app. This:
//   - Unlocks guest accounts immediately using the device-local key.
//   - Keeps authenticated accounts unlocked across page reloads via the
//     session-scoped raw key in sessionStorage.
//   - If neither is available, the app still mounts but sensitive keys read
//     as null (treated as "locked"); the UI surfaces the sign-in prompt.
//
// We intentionally await this before rendering so React never sees a half-
// decrypted state. The bootstrap call never throws.
async function boot() {
  try {
    await rehydrateSecureStore()
  } catch (err) {
    console.error('[ShiftGuard] Secure-store rehydration failed', err)
  }

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  )
}

boot()
