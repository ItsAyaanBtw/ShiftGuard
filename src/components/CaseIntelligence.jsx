import { useEffect, useState } from 'react'
import { Fingerprint, Radar, Activity, Sparkles } from 'lucide-react'
import { computeCaseFingerprint, computeRiskScore } from '../lib/caseSignature'
import { detectShiftPatterns } from '../lib/patternDetectors'

const RISK_STYLES = {
  critical: 'border-red-500/30 bg-red-500/10 text-red-300',
  high: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  moderate: 'border-yellow-500/25 bg-yellow-500/5 text-yellow-200',
  elevated: 'border-slate-600 bg-slate-800/50 text-slate-300',
  none: 'border-slate-700 bg-slate-900 text-slate-400',
}

const PATTERN_STYLES = {
  high: 'border-red-500/20 bg-red-500/5',
  medium: 'border-amber-500/20 bg-amber-500/5',
  low: 'border-slate-700 bg-slate-800/40',
}

/**
 * Deterministic "case intelligence": risk scoring, shift patterns, exhibit fingerprint.
 * This is the defensible layer: rule-engine + heuristics, not generic LLM text.
 */
export default function CaseIntelligence({ shifts, paystub, violations, stateCode, totalOwed }) {
  const [fp, setFp] = useState(null)

  useEffect(() => {
    let cancelled = false
    computeCaseFingerprint({
      shifts,
      paystub,
      violations,
      stateCode,
      totalOwed,
    })
      .then(r => {
        if (!cancelled) setFp(r)
      })
      .catch(() => {
        if (!cancelled) setFp(null)
      })
    return () => { cancelled = true }
  }, [shifts, paystub, violations, stateCode, totalOwed])

  const risk = computeRiskScore(violations, totalOwed)
  const { insights, meta } = detectShiftPatterns(shifts)
  const riskClass = RISK_STYLES[risk.band] || RISK_STYLES.elevated

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center gap-2 text-white">
        <Sparkles className="w-5 h-5 text-terracotta" />
        <h2 className="text-lg font-semibold">Paycheck review signals</h2>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 ml-1">on-device rules</span>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed -mt-2">
        ShiftGuard scores risk and scheduling patterns using your data and state rules, not a chat model.
        Use the fingerprint when you want a stable reference for this exact snapshot of shifts and pay data.
      </p>

      <div className={`rounded-xl border p-4 ${riskClass}`}>
        <div className="flex items-start gap-3">
          <Radar className="w-6 h-6 shrink-0 opacity-90" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">{risk.score}</span>
              <span className="text-sm font-medium capitalize">/100 review index</span>
            </div>
            <p className="text-xs mt-1 opacity-90 capitalize">{risk.band.replace('_', ' ')} review band</p>
            <p className="text-[11px] mt-2 opacity-80 leading-relaxed">
              Weighted from discrepancy types the comparison engine surfaced, plus a small boost from dollar amounts flagged.
              This helps you prioritize what to double-check on your pay advice, not a prediction of legal outcomes.
            </p>
          </div>
        </div>
      </div>

      {insights.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-terracotta" />
            <h3 className="text-sm font-semibold text-white">Shift pattern signals</h3>
            <span className="text-[10px] text-slate-600">{meta.shiftCount} shifts analyzed</span>
          </div>
          <ul className="space-y-2">
            {insights.map(item => (
              <li
                key={item.id}
                className={`rounded-lg border px-3 py-2.5 ${PATTERN_STYLES[item.severity] || PATTERN_STYLES.low}`}
              >
                <p className="text-sm font-medium text-white">{item.title}</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Fingerprint className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Exhibit snapshot fingerprint</h3>
        </div>
        {!fp ? (
          <p className="text-xs text-slate-500">Computing SHA-256 hash of canonical case data…</p>
        ) : (
          <>
            <p className="text-[11px] font-mono text-slate-300 break-all leading-relaxed">{fp.hex}</p>
            <p className="text-[10px] text-slate-600 mt-2 leading-relaxed">
              Same inputs to the comparison engine produce the same fingerprint. If you edit shifts or pay data,
              expect the hash to change. Useful for labeling printouts: &quot;Exhibit A, ShiftGuard snapshot {fp.hex.slice(0, 12)}...&quot;
            </p>
          </>
        )}
      </div>
    </div>
  )
}
