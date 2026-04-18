import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import Landing from './screens/Landing'
import ShiftLogger from './screens/ShiftLogger'
import PaystubUpload from './screens/PaystubUpload'
import Comparison from './screens/Comparison'
import ActionCenter from './screens/ActionCenter'

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
      <Route path="/upload" element={<PaystubUpload />} />
      <Route path="/compare" element={<Comparison />} />
      <Route path="/action" element={<ActionCenter />} />
      <Route
        path="/dashboard"
        element={
          <Suspense fallback={<LoadingFallback />}>
            <Dashboard />
          </Suspense>
        }
      />
    </Routes>
  )
}
