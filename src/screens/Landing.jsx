import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Shield, ArrowRight, Clock, Camera, FileText, BarChart3,
  Play, X, Users, ChevronRight
} from 'lucide-react'
import Disclaimer from '../components/Disclaimer'
import { DEMO_SCENARIOS, loadScenario } from '../lib/demoData'

export default function Landing() {
  const navigate = useNavigate()
  const [showDemoPanel, setShowDemoPanel] = useState(false)

  function handlePickScenario(id) {
    loadScenario(id)
    setShowDemoPanel(false)
    navigate('/log')
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-5 flex items-center justify-between max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <Shield className="w-7 h-7 text-terracotta" />
          <span className="text-xl font-semibold text-white tracking-tight">ShiftGuard</span>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-terracotta/10 border border-terracotta/20 mb-8">
            <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
            <span className="text-terracotta text-sm font-medium">Protecting hourly workers</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            Know exactly what{' '}
            <span className="text-terracotta">you're owed.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-xl mx-auto">
            Wage theft costs American workers $50 billion a year.
            ShiftGuard helps you detect it, document it, and fight back
            in minutes, not months.
          </p>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => navigate('/log')}
              className="inline-flex items-center gap-2 px-8 py-4 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors text-lg cursor-pointer"
            >
              Start tracking
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={() => setShowDemoPanel(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-slate-500 hover:text-terracotta text-sm transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4" />
              Try a demo scenario
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-4xl mx-auto mt-24 w-full">
          <p className="text-center text-sm font-medium text-slate-400 uppercase tracking-widest mb-8">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StepCard
              icon={<Clock className="w-6 h-6" />}
              step="1"
              title="Log your shifts"
              desc="Track hours, breaks, tips, and overtime from your phone."
            />
            <StepCard
              icon={<Camera className="w-6 h-6" />}
              step="2"
              title="Upload your pay stub"
              desc="Snap a photo. Our AI reads it instantly."
            />
            <StepCard
              icon={<FileText className="w-6 h-6" />}
              step="3"
              title="See the difference"
              desc="Hours worked vs. hours paid. Every discrepancy flagged."
            />
            <StepCard
              icon={<BarChart3 className="w-6 h-6" />}
              step="4"
              title="Take action"
              desc="Get a demand letter, complaint form, and attorney referral."
            />
          </div>
        </div>

        {/* Stats bar */}
        <div className="max-w-4xl mx-auto mt-20 w-full grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <Stat value="$50B" label="stolen from workers yearly" />
          <Stat value="68%" label="of low-wage workers affected" />
          <Stat value="2%" label="ever file a complaint" />
          <Stat value="611" label="federal investigators for 165M workers" />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>ShiftGuard</span>
          </div>
          <Disclaimer />
        </div>
      </footer>

      {/* Demo scenario picker modal */}
      {showDemoPanel && (
        <DemoPickerModal
          onPick={handlePickScenario}
          onClose={() => setShowDemoPanel(false)}
        />
      )}
    </div>
  )
}

/* ---------- Demo Picker Modal ---------- */

function DemoPickerModal({ onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-white">Pick a demo scenario</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Each scenario loads real shift data and a pay stub with violations for you to explore.
        </p>

        <div className="space-y-3">
          {DEMO_SCENARIOS.map(s => (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className="w-full text-left bg-slate-800 border border-slate-700 hover:border-terracotta/50 rounded-xl p-4 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-semibold text-sm">{s.name}</span>
                    <span className="text-xs text-slate-600">·</span>
                    <span className="text-xs text-slate-500">{s.industry}</span>
                  </div>
                  <p className="text-sm text-slate-400">{s.role}</p>
                  <p className="text-xs text-slate-500 mt-1.5">{s.summary}</p>
                  <p className="text-xs font-medium text-red-400 mt-1">{s.tagline}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-terracotta shrink-0 mt-1 transition-colors" />
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-600 mt-4 text-center">
          All names and employers are fictional. Data is for demonstration only.
        </p>
      </div>
    </div>
  )
}

/* ---------- Shared ---------- */

function StepCard({ icon, step, title, desc }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-left hover:border-slate-700 transition-colors">
      <div className="flex items-center gap-3 mb-3">
        <div className="text-terracotta">{icon}</div>
        <span className="text-xs font-medium text-slate-500 uppercase">Step {step}</span>
      </div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

function Stat({ value, label }) {
  return (
    <div>
      <div className="text-2xl sm:text-3xl font-bold text-terracotta">{value}</div>
      <div className="text-sm text-slate-400 mt-1">{label}</div>
    </div>
  )
}
