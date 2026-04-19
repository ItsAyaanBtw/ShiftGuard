import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Landing from './screens/Landing'
import ShiftLogger from './screens/ShiftLogger'
import TimesheetUpload from './screens/TimesheetUpload'
import PaystubUpload from './screens/PaystubUpload'
import Comparison from './screens/Comparison'
import PaycheckReport from './screens/PaycheckReport'
import Tools from './screens/Tools'
import Vault from './screens/Vault'
import HistoryScreen from './screens/History'
import Pricing from './screens/Pricing'
import Onboarding from './screens/Onboarding'

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
      <Route path="/" element={<Landing />} />
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
      <Route path="/onboarding" element={<Onboarding />} />
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
