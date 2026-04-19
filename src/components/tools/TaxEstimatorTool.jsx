import { useMemo, useState } from 'react'
import { Calculator, Info } from 'lucide-react'
import { estimateTakeHome } from '../../lib/taxEstimator'
import { ToolHeader, Field } from './MarketRateTool'

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly (every 2 weeks)' },
  { value: 'semimonthly', label: 'Semi-monthly (twice a month)' },
  { value: 'monthly', label: 'Monthly' },
]
const STATUS_OPTIONS = [
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married filing jointly' },
  { value: 'hoh', label: 'Head of household' },
]

export default function TaxEstimatorTool({ ctx }) {
  const paystub = ctx?.paystub || {}
  const prefs = ctx?.preferences || {}
  const defaults = {
    gross: Number(paystub.gross_pay) || 2800,
    frequency: prefs.payFrequency || 'biweekly',
    state: ctx?.stateCode || 'TX',
    status: prefs.filingStatus || 'single',
    dependents: Number(prefs.dependents) || 0,
  }

  const [gross, setGross] = useState(defaults.gross)
  const [frequency, setFrequency] = useState(defaults.frequency)
  const [stateCode, setStateCode] = useState(defaults.state)
  const [filingStatus, setFilingStatus] = useState(defaults.status)
  const [dependents, setDependents] = useState(defaults.dependents)

  const result = useMemo(
    () =>
      estimateTakeHome({
        grossThisCheck: Number(gross) || 0,
        annualizeOver: frequency,
        stateCode,
        filingStatus,
        dependents: Number(dependents) || 0,
      }),
    [gross, frequency, stateCode, filingStatus, dependents],
  )

  return (
    <div>
      <ToolHeader
        icon={<Calculator className="w-4 h-4" />}
        title="Take-home estimator"
        subtitle="What actually lands in your account after federal, FICA, and state tax. 2025 brackets."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
        <Field label="Gross this paycheck ($)">
          <input
            type="number"
            min="0"
            step="1"
            value={gross}
            onChange={e => setGross(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Pay frequency">
          <select
            value={frequency}
            onChange={e => setFrequency(e.target.value)}
            className={inputCls}
          >
            {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="State of employment">
          <input
            type="text"
            value={stateCode}
            onChange={e => setStateCode(e.target.value.trim().toUpperCase().slice(0, 2))}
            maxLength={2}
            className={inputCls}
            placeholder="e.g. TX"
          />
        </Field>
        <Field label="Filing status">
          <select
            value={filingStatus}
            onChange={e => setFilingStatus(e.target.value)}
            className={inputCls}
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Qualifying dependents">
          <input
            type="number"
            min="0"
            step="1"
            value={dependents}
            onChange={e => setDependents(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">You take home</p>
            <p className="mt-1 text-5xl font-semibold text-terracotta nums">
              ${result.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-sm text-slate-300 mt-1">
              on a ${result.gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paycheck
              {frequency === 'weekly' ? ' (weekly)'
                : frequency === 'biweekly' ? ' (biweekly)'
                : frequency === 'semimonthly' ? ' (semi-monthly)'
                : ' (monthly)'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">Effective rate</p>
            <p className="mt-1 text-2xl font-semibold text-white nums">
              {Math.round(result.effectiveRate * 100)}%
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <WithBar label="Federal" value={result.federal} gross={result.gross} />
          <WithBar label="Social Security" value={result.socialSecurity} gross={result.gross} />
          <WithBar label="Medicare" value={result.medicare} gross={result.gross} />
          <WithBar label="State" value={result.stateTax} gross={result.gross} />
        </div>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span>
            Estimate for planning. 2025 IRS brackets + state flat-rate approximation + FICA.
            Real paychecks vary with pre-tax benefits (401(k), HSA, insurance), supplemental withholding,
            and local tax. Use this to size rough take-home, not to file.
          </span>
        </div>

        <p className="mt-3 text-[11px] text-slate-600 leading-relaxed">
          Annualized at {result.periodsPerYear} pay periods per year. Marginal federal rate:{' '}
          {Math.round(result.marginalFederalRate * 100)}%. Not tax advice.
        </p>
      </div>
    </div>
  )
}

function WithBar({ label, value, gross }) {
  const pct = gross > 0 ? Math.min(100, (value / gross) * 100) : 0
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.14em]">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-white nums">
        ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <div className="mt-1.5 h-1 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-full bg-terracotta" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

const inputCls =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm nums focus:outline-none focus:border-terracotta'
