import { useEffect, useReducer } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check } from 'lucide-react'
import { getWorkflowProgress } from '../lib/storage'

const STEPS = [
  { id: 'shifts', label: 'Shifts', path: '/log', key: 'hasShifts' },
  { id: 'verify', label: 'Verify', path: '/verify', key: 'hasTimesheet' },
  { id: 'paystub', label: 'Pay stub', path: '/upload', key: 'hasPaystub' },
  { id: 'compare', label: 'Compare', path: '/compare', key: 'hasCompared' },
]

export default function WorkflowProgress() {
  const { pathname } = useLocation()
  const [, bump] = useReducer(n => n + 1, 0)

  useEffect(() => {
    const onData = () => bump()
    window.addEventListener('shiftguard-data-changed', onData)
    return () => window.removeEventListener('shiftguard-data-changed', onData)
  }, [])

  if (pathname === '/') return null

  const p = getWorkflowProgress()

  return (
    <div className="border-t border-slate-800/80 bg-slate-900/40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2">
        <div className="flex items-center justify-center gap-1 sm:gap-3 flex-wrap">
          {STEPS.map((step, i) => {
            const done = p[step.key]
            const active = pathname === step.path
            return (
              <div key={step.id} className="flex items-center gap-1 sm:gap-3">
                {i > 0 && (
                  <span className="text-slate-700 hidden sm:inline text-xs">·</span>
                )}
                <Link
                  to={step.path}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 text-[11px] sm:text-xs font-medium transition-colors ${
                    active
                      ? 'bg-terracotta/20 text-terracotta'
                      : done
                        ? 'text-slate-400 hover:text-white'
                        : 'text-slate-600 hover:text-slate-400'
                  }`}
                >
                  <span className="relative">
                    <span
                      className={`relative flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                        done
                          ? 'bg-green-500/20 text-green-400'
                          : active
                            ? 'bg-terracotta/30 text-terracotta'
                            : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {done ? <Check className="w-3 h-3" /> : i + 1}
                    </span>
                    {active && (
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 rounded-full sg-breath text-terracotta"
                      />
                    )}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </Link>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
