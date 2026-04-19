import { useState } from 'react'
import { Coins, AlertTriangle } from 'lucide-react'
import { valuePto } from '../../lib/ptoCalc'
import { ToolHeader, Field, EmptyHint } from './MarketRateTool'

export default function PtoValueTool({ ctx }) {
  const defaultRate = Number(ctx?.paystub?.hourly_rate) || 0
  const defaultState = ctx?.stateCode || 'US'

  const [hours, setHours] = useState(80)
  const [rate, setRate] = useState(defaultRate || '')
  const [diffs, setDiffs] = useState('')
  const [anniversary, setAnniversary] = useState('')
  const [cap, setCap] = useState('')

  const result = valuePto({
    accruedHours: Number(hours) || 0,
    hourlyRate: Number(rate) || 0,
    differentialsPerHour: Number(diffs) || 0,
    anniversaryISO: anniversary,
    capHours: cap ? Number(cap) : null,
    stateCode: defaultState,
  })

  const ready = result.valueUSD > 0

  return (
    <div>
      <ToolHeader
        icon={<Coins className="w-4 h-4" />}
        title="PTO value calculator"
        subtitle="Accrued hours × your blended rate. With anniversary and cap warnings."
      />

      <div className="grid grid-cols-2 gap-3 mt-5">
        <Field label="PTO hours accrued">
          <input
            type="number"
            min="0"
            step="1"
            value={hours}
            onChange={e => setHours(e.target.value)}
            className={numInput}
          />
        </Field>
        <Field label="Base hourly rate ($)">
          <input
            type="number"
            min="0"
            step="0.25"
            value={rate}
            onChange={e => setRate(e.target.value)}
            className={numInput}
          />
        </Field>
        <Field label="Avg. differentials ($/hr)">
          <input
            type="number"
            min="0"
            step="0.25"
            value={diffs}
            onChange={e => setDiffs(e.target.value)}
            className={numInput}
          />
        </Field>
        <Field label="Hire anniversary (optional)">
          <input
            type="date"
            value={anniversary}
            onChange={e => setAnniversary(e.target.value)}
            className={numInput}
          />
        </Field>
        <Field label="Accrual cap (optional, hours)">
          <input
            type="number"
            min="0"
            step="1"
            value={cap}
            onChange={e => setCap(e.target.value)}
            className={numInput}
          />
        </Field>
      </div>

      <div className="mt-6">
        {!ready ? (
          <EmptyHint text="Enter your PTO balance and hourly rate to see the dollar value." />
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">Your PTO is worth</p>
            <p className="mt-1 text-5xl font-semibold text-terracotta nums">
              ${result.valueUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-sm text-slate-300">
              {result.hours} hrs × ${((Number(rate) || 0) + (Number(diffs) || 0)).toFixed(2)}/hr blended
            </p>

            {result.atCapRisk && (
              <Warning>
                You are within 10% of your accrual cap ({cap} hrs). Hours above the cap typically stop
                accruing, not forfeit, but your policy may differ. Confirm in your handbook.
              </Warning>
            )}
            {result.forfeitRisk && !result.atCapRisk && (
              <Warning>
                Anniversary is inside 90 days and {defaultState} allows use-it-or-lose-it contract terms.
                Check your employer&rsquo;s policy. California, Montana, and Nebraska generally prohibit
                forfeiture of accrued vacation.
              </Warning>
            )}
            {!result.forfeitRisk && !result.atCapRisk && result.daysToAnniversary != null && (
              <p className="mt-4 text-xs text-slate-500">
                {result.daysToAnniversary} days to your anniversary. No immediate forfeit risk flagged.
              </p>
            )}
            <p className="mt-4 text-[11px] text-slate-600 leading-relaxed">
              Informational estimate; confirm against your employer handbook and state policy.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

function Warning({ children }) {
  return (
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-100 leading-relaxed">
      <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

const numInput =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm nums focus:outline-none focus:border-terracotta'
