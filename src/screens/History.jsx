import { useEffect, useReducer, useMemo, useState } from 'react'
import {
  History as HistoryIcon, Clock, FileText, ShieldCheck, GitCompareArrows, AlertTriangle,
  Info,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { buildAuditTrail } from '../lib/auditTrail'

/**
 * Evidence timeline. Single chronological view of every event the app has recorded:
 * shifts logged, stubs saved, time records uploaded, comparisons run, anomalies surfaced.
 *
 * Use cases: tax audits, wage-claim paperwork, personal record keeping.
 */

const KIND_META = {
  shift: { icon: Clock, tone: 'bg-slate-800 text-slate-200', label: 'Shift' },
  stub: { icon: FileText, tone: 'bg-terracotta/20 text-terracotta', label: 'Stub' },
  timesheet: { icon: ShieldCheck, tone: 'bg-green-500/15 text-green-300', label: 'Time record' },
  check: { icon: GitCompareArrows, tone: 'bg-sky-500/15 text-sky-300', label: 'Check' },
  anomaly: { icon: AlertTriangle, tone: 'bg-amber-500/15 text-amber-300', label: 'Alert' },
}

const FILTERS = ['all', 'shift', 'stub', 'timesheet', 'check', 'anomaly']

export default function HistoryScreen() {
  const [, bump] = useReducer(n => n + 1, 0)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const fn = () => bump()
    window.addEventListener('shiftguard-data-changed', fn)
    return () => window.removeEventListener('shiftguard-data-changed', fn)
  }, [])

  const all = buildAuditTrail()
  const filtered = useMemo(
    () => (filter === 'all' ? all : all.filter(e => e.kind === filter)),
    [all, filter],
  )

  function exportJson() {
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shiftguard-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta mb-3">
            <HistoryIcon className="w-3.5 h-3.5" />
            Evidence timeline
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Everything, in order
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mt-1">
            Every shift you logged, every stub you saved, every comparison you ran, and every anomaly
            the app surfaced. Kept on this device. Export any time.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          {FILTERS.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                filter === f
                  ? 'border-terracotta/50 bg-terracotta/15 text-terracotta'
                  : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
              }`}
            >
              {f === 'all' ? 'All' : KIND_META[f].label}
            </button>
          ))}
          <button
            type="button"
            onClick={exportJson}
            disabled={all.length === 0}
            className="ml-auto text-xs font-medium px-3 py-1.5 rounded-full border border-slate-800 text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Export JSON
          </button>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400 flex items-start gap-3 justify-center">
            <Info className="w-4 h-4 text-slate-500 mt-0.5" />
            <span>No events match this filter yet. Log a shift or upload a pay stub to get started.</span>
          </div>
        ) : (
          <ol className="relative pl-5 space-y-3 border-l border-slate-800">
            {filtered.map(ev => {
              const meta = KIND_META[ev.kind] || KIND_META.check
              const Icon = meta.icon
              const when = ev.at ? new Date(ev.at) : null
              return (
                <li key={ev.id} className="relative">
                  <span className={`absolute -left-[1.4rem] top-1 inline-flex h-6 w-6 rounded-full items-center justify-center ring-2 ring-slate-950 ${meta.tone}`}>
                    <Icon className="w-3 h-3" />
                  </span>
                  <article className="rounded-xl border border-slate-800 bg-slate-900/50 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium">{ev.title}</p>
                        {ev.detail && <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{ev.detail}</p>}
                      </div>
                      {when && (
                        <time className="text-[10px] font-mono text-slate-500 shrink-0 whitespace-nowrap">
                          {when.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </time>
                      )}
                    </div>
                  </article>
                </li>
              )
            })}
          </ol>
        )}

        <div className="mt-10">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}
