import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './screens/Landing'
import EnvelopeLanding from './screens/EnvelopeLanding'
import ShiftLogger from './screens/ShiftLogger'
import TimesheetUpload from './screens/TimesheetUpload'
import PaystubUpload from './screens/PaystubUpload'
import Comparison from './screens/Comparison'
import PaycheckReport from './screens/PaycheckReport'
import Tools from './screens/Tools'
import Vault from './screens/Vault'
import HistoryScreen from './screens/History'
import Pricing from './screens/Pricing'
import Integrations from './screens/Integrations'
import Geofence from './screens/Geofence'
import Security from './screens/Security'
import Auth from './screens/Auth'

const Dashboard = lazy(() => import('./screens/Dashboard'))

function LoadingFallback() {
  return (
    <div className="min-h-dvh bg-slate-950 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<EnvelopeLanding />} />
      <Route path="/envelope" element={<EnvelopeLanding />} />
      <Route path="/landing" element={<Landing />} />
      <Route path="/log" element={<ShiftLogger />} />
      <Route path="/verify" element={<TimesheetUpload />} />
      <Route path="/upload" element={<PaystubUpload />} />
      <Route path="/compare" element={<Comparison />} />
      <Route path="/report" element={<PaycheckReport />} />
      <Route path="/tools" element={<Tools />} />
      <Route path="/vault" element={<Vault />} />
      <Route path="/history" element={<HistoryScreen />} />
      <Route path="/action" element={<Navigate to="/report" replace />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/integrations" element={<Integrations />} />
      <Route path="/geofence" element={<Geofence />} />
      <Route path="/security" element={<Security />} />
      <Route path="/auth" element={<Auth />} />
      {/* Legacy routes (preserved as redirects so old links keep working) */}
      <Route path="/start" element={<Navigate to="/upload" replace />} />
      <Route path="/onboarding" element={<Navigate to="/log" replace />} />
      <Route path="/paystub/:id" element={<Navigate to="/vault" replace />} />
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        }
      />
      {/* Any unknown path lands on the marketing page instead of a blank screen. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
