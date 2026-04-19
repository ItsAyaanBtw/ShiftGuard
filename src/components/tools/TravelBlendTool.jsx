import { useState } from 'react'
import { Plane, AlertTriangle, Info } from 'lucide-react'
import { analyzeTravelPackage } from '../../lib/travelBlend'
import { GSA_TRAVEL_METROS } from '../../data/gsaRates'
import { ToolHeader, Field } from './MarketRateTool'

export default function TravelBlendTool() {
  const [metroSlug, setMetroSlug] = useState('san_francisco')
  const [weeklyGross, setWeeklyGross] = useState(2400)
  const [hoursPerWeek, setHoursPerWeek] = useState(36)
  const [taxableHourlyRate, setTaxableHourlyRate] = useState(25)
  const [lodgingStipend, setLodgingStipend] = useState(1050)
  const [mieStipend, setMieStipend] = useState(420)
  const [hasTaxHome, setHasTaxHome] = useState(true)
  const [weeksOnAssignment, setWeeksOnAssignment] = useState(13)

  const result = analyzeTravelPackage({
    weeklyGrossUSD: Number(weeklyGross) || 0,
    hoursPerWeek: Number(hoursPerWeek) || 36,
    taxableHourlyRate: Number(taxableHourlyRate) || 0,
    weeklyLodgingStipendUSD: Number(lodgingStipend) || 0,
    weeklyMieStipendUSD: Number(mieStipend) || 0,
    metroSlug,
    hasTaxHome,
    weeksOnAssignment: Number(weeksOnAssignment) || 13,
  })

  return (
    <div>
      <ToolHeader
        icon={<Plane className="w-4 h-4" />}
        title="Travel nurse rate X-ray"
        subtitle="Normalize your blended weekly rate against the GSA per-diem ceiling for the assignment city."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <Field label="Assignment city">
          <select
            value={metroSlug}
            onChange={e => setMetroSlug(e.target.value)}
            className={selectInput}
          >
            {GSA_TRAVEL_METROS.map(m => (
              <option key={m.slug} value={m.slug}>{m.name}, {m.state}</option>
            ))}
          </select>
        </Field>
        <Field label="Weeks on assignment">
          <input type="number" min="1" value={weeksOnAssignment} onChange={e => setWeeksOnAssignment(e.target.value)} className={numInput} />
        </Field>
        <Field label="Weekly gross (blended)">
          <input type="number" min="0" step="1" value={weeklyGross} onChange={e => setWeeklyGross(e.target.value)} className={numInput} />
        </Field>
        <Field label="Hours per week">
          <input type="number" min="1" step="1" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} className={numInput} />
        </Field>
        <Field label="Taxable hourly rate ($)">
          <input type="number" min="0" step="0.25" value={taxableHourlyRate} onChange={e => setTaxableHourlyRate(e.target.value)} className={numInput} />
        </Field>
        <Field label="Lodging stipend ($/wk)">
          <input type="number" min="0" step="1" value={lodgingStipend} onChange={e => setLodgingStipend(e.target.value)} className={numInput} />
        </Field>
        <Field label="Meals & incidentals ($/wk)">
          <input type="number" min="0" step="1" value={mieStipend} onChange={e => setMieStipend(e.target.value)} className={numInput} />
        </Field>
        <label className="flex items-center gap-2 sm:col-span-2 mt-4 sm:mt-0">
          <input
            type="checkbox"
            checked={hasTaxHome}
            onChange={e => setHasTaxHome(e.target.checked)}
            className="accent-terracotta"
          />
          <span className="text-xs text-slate-300 leading-relaxed">
            I maintain a permanent residence away from the assignment (IRS tax-home rules, Pub. 463).
          </span>
        </label>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Metric label="Advertised blended rate" value={`$${result.advertisedBlendedRate.toFixed(2)}/hr`} />
          <Metric label="Taxable wage rate" value={`$${result.overtimeBaseRate.toFixed(2)}/hr`} tone="terracotta" />
          <Metric label="Weekly stipend" value={`$${result.weeklyStipend.toFixed(0)}`} />
          <Metric label="GSA ceiling / wk" value={`$${result.weeklyCeiling.toFixed(0)}`} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
          <Metric label="Taxable share of gross" value={result.taxableShareOfGrossPct != null ? `${result.taxableShareOfGrossPct}%` : 'n/a'} />
          <Metric label="Monthly take-home est." value={`$${result.monthlyTakeHomeEstimate.toLocaleString()}`} />
          <Metric label="Assignment gross est." value={`$${result.assignmentGrossEstimate.toLocaleString()}`} />
        </div>

        <div className="mt-5 space-y-2">
          {result.flags.length === 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-green-500/25 bg-green-500/5 px-3 py-2.5 text-xs text-green-200 leading-relaxed">
              <Info className="w-4 h-4 text-green-300 shrink-0 mt-0.5" />
              <span>
                Package looks within normal ranges for {result.metro.name}. Keep documentation of your tax
                home and monthly stipend receipts in case an auditor asks.
              </span>
            </div>
          )}
          {result.flags.map((flag, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${
                flag.severity === 'high'
                  ? 'border-red-500/30 bg-red-500/5 text-red-200'
                  : 'border-amber-500/30 bg-amber-500/5 text-amber-100'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-white">{flag.title}</p>
                <p className="mt-0.5 opacity-90">{flag.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-5 text-[11px] text-slate-600 leading-relaxed">
          Source: GSA Per-Diem Rates (FY 2026) and IRS Publication 463. Informational estimate only,
          not tax advice. Talk to a CPA who specializes in travel contracts before filing.
        </p>
      </div>
    </div>
  )
}

function Metric({ label, value, tone }) {
  const cls = tone === 'terracotta' ? 'text-terracotta' : 'text-white'
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.16em]">{label}</p>
      <p className={`mt-0.5 text-base font-semibold nums ${cls}`}>{value}</p>
    </div>
  )
}

const numInput =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm nums focus:outline-none focus:border-terracotta'

const selectInput =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta'
