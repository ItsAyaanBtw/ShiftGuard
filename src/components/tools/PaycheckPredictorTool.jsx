import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, ArrowRight, Info } from 'lucide-react'
import { projectNextPaychecks } from '../../lib/paycheckPredictor'
import { ToolHeader, EmptyHint } from './MarketRateTool'

/**
 * Paycheck predictor. Renders the next 1 to 4 paycheck projections derived from logged
 * shifts, pay cycle prefs, last paystub, and the tax estimator. Read-only, entirely local.
 */
export default function PaycheckPredictorTool() {
  const [periods, setPeriods] = useState(2)
  const data = useMemo(() => projectNextPaychecks({ periods }), [periods])

  const total = data.projections.reduce((s, p) => s + (p.estimatedNet || 0), 0)
  const totalGross = data.projections.reduce((s, p) => s + (p.projectedGross || 0), 0)
  const totalHours = data.projections.reduce((s, p) => s + (p.hours || 0), 0)

  return (
    <div>
      <ToolHeader
        icon={<TrendingUp className="w-4 h-4" />}
        title="Paycheck predictor"
        subtitle="What your next paychecks will look like based on shifts you've already logged."
      />

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Look ahead</span>
        {[1, 2, 3, 4].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => setPeriods(n)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              periods === n
                ? 'border-terracotta/60 bg-terracotta/15 text-terracotta'
                : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
            }`}
          >
            {n} paycheck{n === 1 ? '' : 's'}
          </button>
        ))}
      </div>

      {data.reason && (
        <div className="mt-5">
          <EmptyHint text={data.reason} />
          <div className="mt-3">
            <Link to="/tools" className="inline-flex items-center gap-1.5 text-xs font-semibold text-terracotta hover:text-terracotta-light">
              Open the next paycheck planner to set it
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      {!data.reason && (
        <>
          <section className="mt-5 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-[11px] font-medium text-terracotta uppercase tracking-[0.18em]">Projected take-home across {periods} paycheck{periods === 1 ? '' : 's'}</p>
                <p className="mt-1 text-4xl font-semibold text-white nums">${total.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-1">
                  on {totalHours.toFixed(1)} logged hours, ${totalGross.toFixed(2)} projected gross
                </p>
              </div>
              <p className="text-[11px] text-slate-500 max-w-[22rem] leading-relaxed">
                Based on shifts already in your log and the last paystub&rsquo;s base rate. Unlogged future
                shifts aren&rsquo;t counted.
              </p>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden">
            <div className="grid grid-cols-12 gap-0 px-4 py-2.5 text-[10px] font-medium text-slate-500 uppercase tracking-[0.14em] border-b border-slate-800">
              <p className="col-span-4">Pay period</p>
              <p className="col-span-2 text-right">Shifts</p>
              <p className="col-span-2 text-right">Hours</p>
              <p className="col-span-2 text-right">Gross</p>
              <p className="col-span-2 text-right">Take-home</p>
            </div>
            {data.projections.map(p => (
              <div key={p.periodStart} className="grid grid-cols-12 gap-0 px-4 py-3 text-sm border-b border-slate-800/60 last:border-0">
                <div className="col-span-4 min-w-0">
                  <p className="text-white font-medium">{p.periodStart} to {p.periodEnd}</p>
                  {p.payday && <p className="text-[11px] text-slate-500">payday {p.payday}</p>}
                </div>
                <p className="col-span-2 text-right text-slate-300 nums">{p.shiftCount}</p>
                <p className="col-span-2 text-right text-slate-200 nums">{p.hours.toFixed(2)}</p>
                <p className="col-span-2 text-right text-slate-100 nums">${p.projectedGross.toFixed(2)}</p>
                <p className="col-span-2 text-right text-terracotta nums font-semibold">${p.estimatedNet.toFixed(2)}</p>
              </div>
            ))}
          </section>

          <p className="mt-4 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              Rough projection. 2025 federal brackets + state flat-rate approximation + FICA. Real paychecks
              vary with pre-tax benefits, supplemental withholding, and differentials. Not tax advice.
            </span>
          </p>
        </>
      )}
    </div>
  )
}
