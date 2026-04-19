import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Pencil, MessageCircle } from 'lucide-react'
import Header from '../components/Header'
import { getPaystub, getPaystubVault } from '../lib/storage'

/**
 * Plain-English paystub explainer. This is the anchor "a-ha" surface for the new
 * positioning. Data comes from the latest saved paystub via getPaystub(); when no
 * stub is available we render a friendly empty state.
 */

const DEDUCTION_HINTS = [
  { match: /federal.*tax|fed.*income|fit\b/i, label: 'Federal income tax', hint: 'Based on your W-4 — funds federal gov' },
  { match: /social.*security|oasdi|ss\s*tax/i, label: 'Social Security (FICA)', hint: '6.2% — retirement benefits' },
  { match: /medicare/i, label: 'Medicare (FICA)', hint: '1.45% — health coverage 65+' },
  { match: /state.*tax|sit\b|state.*income/i, label: 'State income tax', hint: 'Varies by state — funds state gov' },
]

function explainDeduction(name, stateCode) {
  const safe = String(name || '')
  for (const h of DEDUCTION_HINTS) {
    if (h.match.test(safe)) {
      if (h.label === 'State income tax' && stateCode) {
        return { label: safe, hint: `${stateCode} — varies by state` }
      }
      return { label: safe, hint: h.hint }
    }
  }
  return { label: safe || 'Deduction', hint: 'Employer-specific deduction' }
}

function fmtMoney(n) {
  const v = Number(n) || 0
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PaystubDetail() {
  const { id } = useParams()
  const paystub = useMemo(() => {
    const current = getPaystub()
    const vault = getPaystubVault()
    const entries = [
      current && { id: 'current', paystub: current },
      ...vault,
    ].filter(Boolean)

    if (!entries.length) return null
    if (!id) return entries[0].paystub

    const byId = entries.find(entry => entry.id === id || entry.paystubKey === id)
    if (byId) return byId.paystub

    const asIndex = Number.parseInt(id, 10)
    if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < entries.length) {
      return entries[asIndex].paystub
    }

    return entries[0].paystub
  }, [id])

  if (!paystub) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col">
        <Header />
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10">
          <BackLink />
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center">
            <p className="text-white font-medium">No paystub on file yet</p>
            <p className="mt-1 text-slate-500 text-sm">
              Upload one from the paystub screen and we&rsquo;ll break it down for you here.
            </p>
            <Link
              to="/upload"
              className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold transition-colors"
            >
              Upload a paystub
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const employer = paystub.employer_name || 'Your employer'
  const payDate = paystub.pay_date || paystub.pay_period_end
  const gross = Number(paystub.gross_pay) || 0
  const net = Number(paystub.net_pay) || 0
  const hours = Number(paystub.hours_paid || 0) + Number(paystub.overtime_hours_paid || 0)

  const deductions = Array.isArray(paystub.deductions) ? paystub.deductions : []
  const totalDeductions = deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0)

  // Segmented bar proportions. Treat any non-tax deduction as "other" for the visual.
  const fed = deductions.find(d => /federal.*tax|fed.*income|fit\b/i.test(d.name || ''))?.amount || 0
  const ss = deductions.find(d => /social.*security|oasdi|ss\s*tax/i.test(d.name || ''))?.amount || 0
  const med = deductions.find(d => /medicare/i.test(d.name || ''))?.amount || 0
  const state = deductions.find(d => /state.*tax|sit\b|state.*income/i.test(d.name || ''))?.amount || 0
  const other = Math.max(0, totalDeductions - fed - ss - med - state)
  const segments = [
    { key: 'take', label: 'Take home', amount: net, color: '#4ade80' },
    { key: 'fed', label: 'Federal tax', amount: fed, color: '#d9774a' },
    { key: 'fica', label: 'FICA (SS + Medicare)', amount: ss + med, color: '#f59e0b' },
    { key: 'state', label: 'State tax', amount: state, color: '#b8bcd0' },
    { key: 'other', label: 'Other', amount: other, color: '#6b7088' },
  ].filter(s => s.amount > 0)
  const total = segments.reduce((s, x) => s + x.amount, 0) || 1

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-10 pb-24">
        <BackLink />

        <header className="mt-4">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">
            Paystub &mdash; {employer}{payDate ? `, ${fmtDate(payDate)}` : ''}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Pay period: {fmtDate(paystub.pay_period_start)} &ndash; {fmtDate(paystub.pay_period_end)}
            {hours > 0 ? ` · ${hours.toFixed(1)} hrs` : ''}
          </p>
        </header>

        {/* Hero card */}
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 glass-edge p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Take home</p>
              <p className="mt-1 text-[28px] sm:text-[32px] font-bold text-white nums leading-none">
                ${fmtMoney(net)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Gross earned</p>
              <p className="mt-1 text-lg font-semibold text-slate-200 nums">${fmtMoney(gross)}</p>
            </div>
          </div>

          {segments.length > 0 && (
            <>
              <div className="mt-5 h-3 w-full rounded-full overflow-hidden bg-slate-800 flex">
                {segments.map(seg => (
                  <div
                    key={seg.key}
                    style={{ width: `${(seg.amount / total) * 100}%`, background: seg.color }}
                    title={`${seg.label}: $${fmtMoney(seg.amount)}`}
                  />
                ))}
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {segments.map(seg => (
                  <li key={seg.key} className="inline-flex items-center gap-2 text-xs text-slate-400">
                    <span className="h-2 w-2 rounded-full" style={{ background: seg.color }} />
                    <span className="text-slate-300">{seg.label}</span>
                    <span className="text-slate-500 nums">${fmtMoney(seg.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* Plain English explainer */}
        <section
          className="mt-5 rounded-2xl p-5 sm:p-6"
          style={{
            border: '1px solid rgba(99,140,210,0.28)',
            background: 'rgba(99,140,210,0.06)',
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: '#8fb1e6' }}>
            Plain English
          </p>
          {/* TODO: replace with an LLM-generated summary via src/lib/claudeClient.js */}
          <p className="mt-2 text-[15px] sm:text-base text-slate-200 leading-relaxed">
            You earned <span className="font-semibold text-white">${fmtMoney(gross)}</span> this period
            {hours > 0 ? <> for <span className="font-semibold text-white">{hours.toFixed(1)} hours</span></> : null}
            {' '}at {employer}. After taxes and other deductions totaling{' '}
            <span className="font-semibold text-white">${fmtMoney(totalDeductions)}</span>, your take-home
            pay was <span className="font-semibold text-white">${fmtMoney(net)}</span>. The biggest chunks
            taken out are typically federal income tax, Social Security (6.2%), and Medicare (1.45%) —
            scroll down for a line-by-line breakdown.
          </p>
        </section>

        {/* Deductions */}
        {deductions.length > 0 && (
          <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">Deductions breakdown</h2>
              <span className="text-xs text-slate-500 nums">Total: -${fmtMoney(totalDeductions)}</span>
            </div>
            <ul className="mt-4 divide-y divide-slate-800">
              {deductions.map((d, i) => {
                const { label, hint } = explainDeduction(d.name, paystub.state)
                return (
                  <li key={`${d.name}-${i}`} className="py-3 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
                    </div>
                    <p className="text-sm font-mono nums text-amber-400 whitespace-nowrap">
                      -${fmtMoney(d.amount)}
                    </p>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Bottom actions */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            // TODO: wire to LLM chat — pass paystub JSON as context to Claude
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white font-semibold text-sm min-h-[48px] transition-colors"
            aria-label="Ask about this paystub"
          >
            <MessageCircle className="w-4 h-4" />
            Ask about this paystub
          </button>
          <Link
            to="/upload"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-200 text-sm font-medium min-h-[48px] transition-colors"
            aria-label="Edit paystub"
          >
            <Pencil className="w-4 h-4" />
            <span className="sm:inline">Edit</span>
          </Link>
        </div>
      </main>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      to="/dashboard"
      className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to dashboard
    </Link>
  )
}
