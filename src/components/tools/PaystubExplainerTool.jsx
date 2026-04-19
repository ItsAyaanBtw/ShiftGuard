import { useEffect, useState } from 'react'
import { FileText, Loader2, RefreshCcw, Sparkles, AlertCircle } from 'lucide-react'
import { explainPaystub } from '../../lib/paystubExplainer'
import { ToolHeader, EmptyHint } from './MarketRateTool'

/**
 * Paystub explainer. Reads the currently saved paystub from ctx (already normalized by
 * storage), builds a structured breakdown deterministically, and layers a warm narrative
 * on top using the Claude text client with a deterministic fallback.
 */
export default function PaystubExplainerTool({ ctx }) {
  const paystub = ctx?.paystub
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    if (!paystub) return
    setLoading(true); setError('')
    try {
      const r = await explainPaystub(paystub)
      setResult(r)
    } catch (e) {
      setError(e.message || 'Could not explain this stub.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (paystub) run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paystub?.employer_name, paystub?.pay_period_end, paystub?.gross_pay])

  if (!paystub) {
    return (
      <div>
        <ToolHeader
          icon={<FileText className="w-4 h-4" />}
          title="Paystub explainer"
          subtitle="Plain-language breakdown of every line on your last paystub."
        />
        <div className="mt-5">
          <EmptyHint text="Upload a paystub first from the Pay stub tab, then come back here." />
        </div>
      </div>
    )
  }

  const data = result?.data
  return (
    <div>
      <ToolHeader
        icon={<FileText className="w-4 h-4" />}
        title="Paystub explainer"
        subtitle="Your last paystub in plain language. Every line, every dollar."
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-3.5 py-2 rounded-xl disabled:opacity-60"
        >
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : result ? <RefreshCcw className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />
          }
          {result ? 'Re-run' : 'Explain this stub'}
        </button>
        {result?.source === 'ai' && (
          <span className="text-[11px] text-slate-500">Written with the scanning service; verify against the actual stub.</span>
        )}
        {result?.source === 'template' && (
          <span className="text-[11px] text-slate-500">Using the offline breakdown (scanning service unavailable).</span>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <section className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-950/40 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Earnings</h3>
            <ul className="space-y-2 text-sm">
              {data.earnings.lines.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-200">{l.label}</p>
                    <p className="text-[11px] text-slate-500">{l.detail}</p>
                  </div>
                  <p className="nums font-mono text-white">${l.amount.toFixed(2)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-sm">
              <p className="text-slate-300 font-medium">Gross pay</p>
              <p className="text-white font-semibold nums">${data.earnings.gross.toFixed(2)}</p>
            </div>

            <h3 className="mt-6 text-sm font-semibold text-white mb-3">Deductions</h3>
            {data.deductions.lines.length === 0 ? (
              <p className="text-xs text-slate-500">No deductions listed on this stub.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {data.deductions.lines.map((d, i) => (
                  <li key={i} className="flex flex-col gap-1 pb-3 border-b border-slate-800/60 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-slate-200">{d.name}</p>
                        <p className="text-[11px] text-slate-500">{d.categoryLabel}</p>
                      </div>
                      <p className="nums font-mono text-red-300">-${d.amount.toFixed(2)}</p>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{d.summary}</p>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-sm">
              <p className="text-slate-300 font-medium">Deductions total</p>
              <p className="text-red-300 font-semibold nums">-${data.deductions.total.toFixed(2)}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5 flex flex-col">
            <h3 className="text-sm font-semibold text-white">Take-home</h3>
            <p className="mt-1 text-3xl font-semibold text-white nums">${data.net.toFixed(2)}</p>
            <p className="text-[11px] text-slate-400 mt-1">
              For {data.hours.total.toFixed(2)} h worked.
            </p>
            <dl className="mt-4 space-y-2 text-xs">
              <Row label="Gross / hour" value={`$${data.hourly.grossPerHour.toFixed(2)}`} />
              <Row label="Deductions / hour" value={`-$${data.hourly.deductionsPerHour.toFixed(2)}`} tone="warn" />
              <Row label="Net / hour" value={`$${data.hourly.netPerHour.toFixed(2)}`} tone="good" />
            </dl>
            {typeof data.parseConfidence === 'number' && (
              <p className="mt-4 text-[10px] text-slate-500">
                Parser confidence: {Math.round(data.parseConfidence * 100)}%
              </p>
            )}
          </section>
        </div>
      )}

      {result?.narrative && (
        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
          <h3 className="text-sm font-semibold text-white mb-2">In plain language</h3>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {result.narrative}
          </div>
          <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">
            Informational. Not legal or tax advice. Numbers reflect the last parsed stub, which you reviewed
            before saving.
          </p>
        </section>
      )}
    </div>
  )
}

function Row({ label, value, tone }) {
  const color = tone === 'warn' ? 'text-red-300' : tone === 'good' ? 'text-green-300' : 'text-white'
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`nums font-mono ${color}`}>{value}</dd>
    </div>
  )
}
