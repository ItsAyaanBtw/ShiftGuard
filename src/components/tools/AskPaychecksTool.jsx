import { useState } from 'react'
import { MessagesSquare, Sparkles, Loader2, AlertCircle, Search } from 'lucide-react'
import { askPaychecks } from '../../lib/paycheckSearch'
import { ToolHeader, EmptyHint } from './MarketRateTool'

const QUICK_PROMPTS = [
  'How much did I make in March 2026?',
  'What was my last paycheck?',
  'Federal tax withheld over the last few stubs?',
  'Which pay period had the highest take-home?',
]

/**
 * "Ask your paychecks" — a deliberately tiny RAG over the on-device vault.
 * Selects up to three relevant paystubs, packages them as constrained context, and
 * asks the assistant a single bounded question. Falls back to a plain-text "here are
 * the matches" answer if the assistant call fails.
 */
export default function AskPaychecksTool() {
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function ask(text) {
    const q = String(text || prompt || '').trim()
    if (!q) return
    setBusy(true); setError('')
    try {
      const r = await askPaychecks(q)
      setResult(r)
      if (r.source === 'fallback' && r.error) setError(r.error)
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ask()
    }
  }

  return (
    <div>
      <ToolHeader
        icon={<MessagesSquare className="w-4 h-4" />}
        title="Ask your paychecks"
        subtitle="Type a question about a pay period, an employer, a deduction. Search runs on this device, then a single short assistant call answers using only your records."
      />

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <label className="block">
          <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-2">
            Question
          </span>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={onKey}
              rows={2}
              placeholder="e.g. How much state tax came out in February?"
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 pr-12 text-sm focus:outline-none focus:border-terracotta resize-none"
            />
            <button
              type="button"
              onClick={() => ask()}
              disabled={busy || !prompt.trim()}
              className="absolute right-2 top-2 inline-flex items-center justify-center w-9 h-9 rounded-lg bg-terracotta hover:bg-terracotta-dark text-white disabled:opacity-50"
              aria-label="Ask"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            </button>
          </div>
        </label>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => { setPrompt(p); ask(p) }}
              className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:border-terracotta/40 hover:text-terracotta"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result?.matches?.length === 0 && (
        <div className="mt-4">
          <EmptyHint text="No paystubs saved yet. Upload one from the Pay stub tab and the search becomes useful." />
        </div>
      )}

      {result?.answer && (
        <section className="mt-5 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
          <div className="flex items-center gap-2 text-terracotta">
            <Sparkles className="w-4 h-4" />
            <p className="text-[11px] font-medium uppercase tracking-[0.16em]">Answer</p>
          </div>
          <p className="mt-2 text-sm text-slate-100 leading-relaxed whitespace-pre-wrap">{result.answer}</p>
          {!result.anyMatched && (
            <p className="mt-3 text-[11px] text-amber-300">
              No strong keyword match in your vault, so I pulled the three most recent paystubs and answered from those.
            </p>
          )}
        </section>
      )}

      {result?.matches?.length > 0 && (
        <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
              {result.matches.length} of {result.total} paystubs used as context
            </p>
          </div>
          <ul className="space-y-2 text-sm">
            {result.matches.map((m, i) => (
              <li key={i} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-white font-medium truncate">{m.employer}</p>
                  <p className="text-xs text-slate-500 nums">${m.netPay.toFixed(2)} net</p>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {m.period} · gross ${m.grossPay.toFixed(2)} · {m.hoursPaid + m.overtimeHoursPaid} hrs
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-5 text-[11px] text-slate-600 leading-relaxed">
        Reads only the paystubs in your vault on this device. No outside data, no chat history kept.
        One question, one short call, one answer.
      </p>
    </div>
  )
}
