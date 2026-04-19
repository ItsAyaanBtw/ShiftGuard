import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { saveOnboarding, saveUserPreferences, saveUserState } from '../lib/storage'
import stateLaws from '../data/stateLaws'

const INDUSTRIES = [
  { id: 'healthcare', label: 'Healthcare (nurse, CNA, tech, etc.)' },
  { id: 'warehouse_retail', label: 'Warehouse / retail' },
  { id: 'restaurant', label: 'Restaurant / food service' },
  { id: 'other_hourly', label: 'Other hourly work' },
]

const PAY_SITUATIONS = [
  { id: 'single_rate', label: 'Single hourly rate' },
  { id: 'multi_rate', label: 'Multiple rates (shift differentials, etc.)' },
  { id: 'tipped', label: 'Tipped worker' },
  { id: 'multi_employer', label: 'Multiple employers' },
]

export default function Onboarding() {
  const navigate = useNavigate()
  const [industry, setIndustry] = useState('')
  const [stateCode, setStateCode] = useState('TX')
  const [paySituation, setPaySituation] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    saveOnboarding({ industry, stateCode, paySituation, completedAt: new Date().toISOString() })
    saveUserState(stateCode)
    const healthcareMode = industry === 'healthcare' || paySituation === 'multi_rate'
    saveUserPreferences({
      industry,
      paySituation,
      healthcareMode,
    })
    navigate('/log')
  }

  const states = Object.values(stateLaws)

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-lg mx-auto w-full px-4 sm:px-6 py-8 pb-24">
        <h1 className="text-2xl font-bold text-white mb-1">Quick setup</h1>
        <p className="text-slate-400 text-sm mb-8">
          Three questions so we can tailor shift logging and paycheck checks. You can change this anytime in the shift
          logger.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              1. What industry do you work in?
            </label>
            <div className="space-y-2">
              {INDUSTRIES.map(opt => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    industry === opt.id
                      ? 'border-terracotta bg-terracotta/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="industry"
                    value={opt.id}
                    checked={industry === opt.id}
                    onChange={() => setIndustry(opt.id)}
                    className="accent-terracotta"
                  />
                  <span className="text-sm text-slate-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              2. Where do you work? (state)
            </label>
            <select
              value={stateCode}
              onChange={e => setStateCode(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-3 py-3 text-sm focus:outline-none focus:border-terracotta"
            >
              {states.map(s => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              3. What&apos;s your pay situation?
            </label>
            <div className="space-y-2">
              {PAY_SITUATIONS.map(opt => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    paySituation === opt.id
                      ? 'border-terracotta bg-terracotta/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="paySituation"
                    value={opt.id}
                    checked={paySituation === opt.id}
                    onChange={() => setPaySituation(opt.id)}
                    className="accent-terracotta"
                  />
                  <span className="text-sm text-slate-200">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={!industry || !paySituation}
            className="w-full py-3.5 rounded-xl bg-terracotta hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-colors cursor-pointer"
          >
            Continue to shift log
          </button>
        </form>

        <div className="mt-10">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}
