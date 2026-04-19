import { Link } from 'react-router-dom'
import { Scale, ArrowRight, Info } from 'lucide-react'
import { computeRetroPayEstimate } from '../../lib/retroPay'
import stateLaws from '../../data/stateLaws'
import { ToolHeader } from './MarketRateTool'

export default function RetroPayTool({ ctx }) {
  const stateCode = ctx?.stateCode || 'US'
  const result = computeRetroPayEstimate({ stateCode })
  const stateName = stateLaws[stateCode]?.name || 'your state'

  const hasAny = result.totalInWindow > 0 || result.totalOnFile > 0

  return (
    <div>
      <ToolHeader
        icon={<Scale className="w-4 h-4" />}
        title="Retro pay estimate"
        subtitle={`Potentially owed wages across your checks on file, within the ${result.lookbackLabel} lookback for ${stateName}.`}
      />

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
          <p className="text-[11px] font-medium text-terracotta uppercase tracking-[0.18em]">Within lookback window</p>
          <p className="mt-1 text-4xl font-semibold text-white nums">
            ${result.totalInWindow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-400 mt-2">{result.periodsInWindow} pay periods · {result.citation}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">All flagged on file</p>
          <p className="mt-1 text-3xl font-semibold text-slate-200 nums">
            ${result.totalOnFile.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {result.periodsOutsideWindow > 0
              ? `${result.periodsOutsideWindow} period(s) fall outside the state lookback.`
              : 'No periods fall outside the lookback.'}
          </p>
        </div>
      </div>

      {!hasAny && (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 text-sm text-slate-300 flex items-start gap-3">
          <Info className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-white">Nothing flagged yet</p>
            <p className="text-slate-400 mt-1 leading-relaxed">
              Run a paycheck comparison to start building a history. Once you have two or three checks
              with flagged amounts, this view gives you the dollar anchor to bring to payroll.
            </p>
            <Link
              to="/compare"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:text-terracotta-light"
            >
              Go to comparison
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {hasAny && result.breakdown.length > 0 && (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-medium text-white">Pay period breakdown</p>
            <span className="text-[11px] text-slate-500">newest first</span>
          </div>
          <ul className="divide-y divide-slate-800/80">
            {result.breakdown.map(row => (
              <li key={row.paystubKey} className="px-4 py-3 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{row.employer || 'Employer'}</p>
                  <p className="text-xs text-slate-500">{row.periodStart || 'period start'} to {row.periodEnd || 'period end'}</p>
                </div>
                <p className="font-mono nums text-terracotta">
                  ${row.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-5 text-[11px] text-slate-600 leading-relaxed">
        Estimate only. Not legal advice. State statute limits (FLSA 2 year / 3 year willful, CA 3-4 year,
        NY 6 year) cap what courts typically consider recoverable. Your state labor department can explain
        the specific rules for your situation.
      </p>
    </div>
  )
}
