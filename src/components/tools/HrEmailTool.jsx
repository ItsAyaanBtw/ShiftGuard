import { useState } from 'react'
import { Mail, Copy, RefreshCcw, AlertCircle, Check } from 'lucide-react'
import { draftPayDiscrepancyEmail } from '../../lib/hrEmail'
import { normalizeAnalysis } from '../../lib/analysisUtils'
import { getViolations } from '../../lib/storage'
import stateLaws from '../../data/stateLaws'
import { ToolHeader } from './MarketRateTool'

export default function HrEmailTool({ ctx }) {
  const analysis = normalizeAnalysis(getViolations())
  const stateName = stateLaws[ctx?.stateCode]?.name || ''
  const paystub = ctx?.paystub || {}
  const payPeriod = paystub.pay_period_start && paystub.pay_period_end
    ? `${paystub.pay_period_start} to ${paystub.pay_period_end}`
    : ''

  const [workerName, setWorkerName] = useState('')
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [tone, setTone] = useState('neutral')

  const hasFindings = (analysis?.discrepancies?.length || 0) > 0

  async function generate() {
    setLoading(true)
    setCopied(false)
    try {
      const d = await draftPayDiscrepancyEmail({
        workerName: workerName.trim(),
        employerName: paystub.employer_name || '',
        payPeriod,
        stateName,
        discrepancies: analysis?.discrepancies || [],
        totalDifference: analysis?.totalDifference || 0,
      })
      setDraft(d)
    } finally {
      setLoading(false)
    }
  }

  function copy(text) {
    navigator.clipboard?.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2200)
  }

  const fullText = draft ? `Subject: ${draft.subject}\n\n${draft.body}` : ''

  return (
    <div>
      <ToolHeader
        icon={<Mail className="w-4 h-4" />}
        title="Draft an inquiry email"
        subtitle="A short, factual message to payroll from your last comparison. Your words, just formatted."
      />

      {!hasFindings ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-white">Run a comparison first</p>
            <p className="text-slate-400 mt-1 leading-relaxed">
              The draft is built from whatever the comparison engine flagged. Head to Compare, run
              the check, then come back here.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            <label className="block sm:col-span-2">
              <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em] mb-1">Your name (how you want to sign)</span>
              <input
                type="text"
                value={workerName}
                onChange={e => setWorkerName(e.target.value)}
                placeholder="First Last"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em] mb-1">Tone</span>
              <select
                value={tone}
                onChange={e => setTone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
              >
                <option value="neutral">Neutral (recommended)</option>
                <option value="warm">Warm</option>
                <option value="direct">Direct</option>
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Drafting…
                </>
              ) : draft ? (
                <>
                  <RefreshCcw className="w-4 h-4" />
                  Re-draft
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Draft the email
                </>
              )}
            </button>
            {draft && (
              <>
                <button
                  type="button"
                  onClick={() => copy(fullText)}
                  className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied' : 'Copy full email'}
                </button>
                <span className="text-[11px] text-slate-500 ml-1">
                  Source: {draft.source === 'ai' ? 'drafted with the scanning service' : 'local template'}
                </span>
              </>
            )}
          </div>

          {draft && (
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Subject</p>
                <textarea
                  value={draft.subject}
                  onChange={e => setDraft(d => d && { ...d, subject: e.target.value })}
                  rows={1}
                  className="w-full bg-transparent text-white text-sm font-medium focus:outline-none resize-none"
                />
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500 mb-1">Body</p>
                <textarea
                  value={draft.body}
                  onChange={e => setDraft(d => d && { ...d, body: e.target.value })}
                  rows={Math.min(18, Math.max(10, draft.body.split('\n').length + 1))}
                  className="w-full bg-transparent text-slate-100 text-sm leading-relaxed focus:outline-none resize-vertical"
                />
              </div>
            </div>
          )}

          <p className="mt-5 text-[11px] text-slate-600 leading-relaxed">
            Template only. These are your facts, your voice. Not legal advice. Review the draft before
            sending. If you need more help after payroll responds, your state labor department has free
            resources you can contact.
          </p>
        </>
      )}
    </div>
  )
}
