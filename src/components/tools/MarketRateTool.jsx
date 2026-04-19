import { useState } from 'react'
import { TrendingUp, Share2 } from 'lucide-react'
import { analyzeMarketRate, OCCUPATIONS, STATES_WITH_DATA } from '../../lib/marketRate'
import stateLaws from '../../data/stateLaws'

/**
 * "Am I underpaid?" tool. Compares the user's base hourly rate to the BLS OEWS
 * quartile distribution for their role and state. No backend calls; data is static.
 */
export default function MarketRateTool({ ctx }) {
  const defaultRate = Number(ctx?.paystub?.hourly_rate) || 0
  const defaultState = ctx?.stateCode || 'US'
  const defaultOccupation = ctx?.preferences?.occupationCode || '29-1141'

  const [rate, setRate] = useState(defaultRate || '')
  const [stateCode, setStateCode] = useState(defaultState)
  const [occupationCode, setOccupationCode] = useState(defaultOccupation)

  const result = analyzeMarketRate({
    hourlyRate: Number(rate) || 0,
    stateCode,
    occupationCode,
  })

  const stateOptions = [
    { code: 'US', name: 'National benchmark' },
    ...STATES_WITH_DATA.filter(c => c !== 'US').map(c => ({
      code: c,
      name: stateLaws[c]?.name || c,
    })),
  ]

  return (
    <div>
      <ToolHeader
        icon={<TrendingUp className="w-4 h-4" />}
        title="Am I underpaid?"
        subtitle="Your base hourly rate vs. BLS OEWS medians for your role and state."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <Field label="Base hourly rate ($)">
          <input
            type="number"
            min="0"
            step="0.25"
            inputMode="decimal"
            value={rate}
            onChange={e => setRate(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm nums focus:outline-none focus:border-terracotta"
          />
        </Field>
        <Field label="Role">
          <select
            value={occupationCode}
            onChange={e => setOccupationCode(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
          >
            {OCCUPATIONS.map(o => (
              <option key={o.code} value={o.code}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <select
            value={stateCode}
            onChange={e => setStateCode(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
          >
            {stateOptions.map(s => (
              <option key={s.code} value={s.code}>{s.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-6">
        {result.status === 'no-rate' && (
          <EmptyHint text="Enter a base hourly rate to see your percentile." />
        )}
        {result.status === 'no-data' && (
          <EmptyHint text="We do not have BLS data cached for that role yet. Try another role or the national benchmark." />
        )}
        {result.status === 'ok' && <MarketRateResult result={result} />}
      </div>
    </div>
  )
}

function MarketRateResult({ result }) {
  const {
    rate, occupation, stateCode, stateFallback,
    p25, median, p75, percentile, band,
    belowMedianPct, aboveMedianPct,
  } = result

  const barPos = `${Math.min(95, Math.max(5, percentile))}%`

  const headline = belowMedianPct > 0
    ? `You are ${belowMedianPct}% below the median for ${occupation} in ${stateFallback ? 'the national benchmark' : stateCode}.`
    : aboveMedianPct > 0
      ? `You are ${aboveMedianPct}% above the median for ${occupation} in ${stateFallback ? 'the national benchmark' : stateCode}.`
      : `You are close to the median for ${occupation} in ${stateFallback ? 'the national benchmark' : stateCode}.`

  const copyLine = `${occupation} · ${stateFallback ? 'US' : stateCode} · $${rate.toFixed(2)}/hr = ~${percentile}th percentile (BLS OEWS).`

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">Your percentile</p>
          <p className="mt-1 text-4xl font-semibold text-white nums">
            {percentile}<span className="text-xl text-slate-500">th</span>
          </p>
          <p className="text-sm text-slate-300 mt-1">{band}</p>
        </div>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(copyLine)}
          title="Copy summary"
          className="text-[11px] font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 inline-flex items-center gap-1.5"
        >
          <Share2 className="w-3 h-3" />
          Copy summary
        </button>
      </div>

      <div className="mt-4">
        <div className="relative h-2 rounded-full bg-slate-800 overflow-visible">
          <div
            className="absolute top-0 bottom-0 left-0 rounded-full bg-gradient-to-r from-amber-400 via-terracotta to-green-400"
            style={{ width: '100%' }}
          />
          <div
            className="absolute -top-1.5 h-5 w-[2px] bg-white"
            style={{ left: barPos }}
            aria-hidden
          />
          <div
            className="absolute -top-7 text-[10px] font-mono text-white -translate-x-1/2 whitespace-nowrap"
            style={{ left: barPos }}
          >
            you · ${rate.toFixed(2)}
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 mt-2 nums">
          <span>p25 ${p25.toFixed(2)}</span>
          <span>median ${median.toFixed(2)}</span>
          <span>p75 ${p75.toFixed(2)}</span>
        </div>
      </div>

      <p className="mt-5 text-sm text-slate-300 leading-relaxed">{headline}</p>
      {stateFallback && (
        <p className="mt-2 text-xs text-slate-500">
          We don&rsquo;t have state-level data cached for this role yet; showing national benchmark.
        </p>
      )}

      <p className="mt-4 text-[11px] text-slate-600 leading-relaxed">
        Source: BLS Occupational Employment &amp; Wage Statistics, May 2024 release. Percentile inferred via
        interpolation between published quartiles.
      </p>
    </div>
  )
}

export function ToolHeader({ icon, title, subtitle }) {
  return (
    <header>
      <div className="flex items-center gap-2 text-terracotta">
        <div className="h-7 w-7 rounded-lg bg-terracotta/15 flex items-center justify-center">
          {icon}
        </div>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em]">{title}</p>
      </div>
      <h2 className="mt-3 text-xl sm:text-2xl font-semibold text-white tracking-tight">
        {title}
      </h2>
      <p className="mt-1 text-sm text-slate-400 leading-relaxed">{subtitle}</p>
    </header>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em] mb-1">{label}</span>
      {children}
    </label>
  )
}

export function EmptyHint({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-5 text-center text-sm text-slate-400">
      {text}
    </div>
  )
}
