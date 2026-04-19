import { useState } from 'react'
import { TrendingUp, TrendingDown, Share2, Minus } from 'lucide-react'
import { analyzeMarketRate, OCCUPATIONS, STATES_WITH_DATA } from '../../lib/marketRate'
import stateLaws from '../../data/stateLaws'

/**
 * Am I underpaid? Compares the user's hourly rate to BLS OEWS quartiles for their role
 * and state. Visual was tightened: a real percentile readout with a band tag, a
 * three-zone quartile bar with anchored P25/Median/P75 labels under it, and a clamped
 * "you" marker that never escapes the bar. Headline framing leads with the dollar gap
 * to the median, which is the number the user actually wants.
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
        subtitle="Your base hourly rate vs. BLS Occupational Employment Statistics for your role and state."
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
            placeholder="e.g. 22.50"
            className={inputCls}
          />
        </Field>
        <Field label="Role">
          <select
            value={occupationCode}
            onChange={e => setOccupationCode(e.target.value)}
            className={inputCls}
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
            className={inputCls}
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
          <EmptyHint text="No BLS data cached for that role yet. Try another role or the national benchmark." />
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
    belowMedianPct, aboveMedianPct, delta,
  } = result

  const ToneIcon = belowMedianPct > 0 ? TrendingDown : aboveMedianPct > 0 ? TrendingUp : Minus
  const toneColor = belowMedianPct > 0
    ? 'text-amber-300'
    : aboveMedianPct > 0
      ? 'text-green-300'
      : 'text-slate-300'

  // Clamped marker so very-low / very-high rates don't fall off either end.
  const markerLeft = clamp(percentile, 4, 96)

  // Position the median tick and quartile boundaries proportional to the percentile
  // axis (which we already inferred quartile-by-quartile in marketRate.js).
  const pCopyLine =
    `${occupation} (${stateFallback ? 'US' : stateCode}) at $${rate.toFixed(2)}/hr is ~${percentile}th percentile per BLS OEWS.`

  return (
    <div className="space-y-5">
      {/* Headline stat row */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">
              {occupation} {stateFallback ? '(national)' : `(${stateCode})`}
            </p>
            <div className="mt-1 flex items-baseline gap-3">
              <p className="text-5xl font-semibold text-white nums tracking-tight">
                {percentile}<span className="text-2xl text-slate-500">th</span>
              </p>
              <span className={`inline-flex items-center gap-1 text-sm font-medium ${toneColor}`}>
                <ToneIcon className="w-4 h-4" />
                {band}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              {belowMedianPct > 0 && (
                <>
                  You earn <span className="text-white font-semibold nums">${rate.toFixed(2)}/hr</span>.
                  The median is <span className="text-white font-semibold nums">${median.toFixed(2)}/hr</span>, so
                  you sit <span className="text-amber-300 font-semibold">${Math.abs(delta).toFixed(2)}/hr</span> below it.
                </>
              )}
              {aboveMedianPct > 0 && (
                <>
                  You earn <span className="text-white font-semibold nums">${rate.toFixed(2)}/hr</span>, which is{' '}
                  <span className="text-green-300 font-semibold">${delta.toFixed(2)}/hr</span> above the median of{' '}
                  <span className="text-white font-semibold nums">${median.toFixed(2)}/hr</span>.
                </>
              )}
              {belowMedianPct === 0 && aboveMedianPct === 0 && (
                <>You are right at the median for this role and location.</>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(pCopyLine)}
            title="Copy summary"
            className="text-[11px] font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 inline-flex items-center gap-1.5 shrink-0"
          >
            <Share2 className="w-3 h-3" />
            Copy
          </button>
        </div>
      </section>

      {/* Quartile bar */}
      <section className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em]">
            Where you sit in the wage distribution
          </p>
          <p className="text-[11px] text-slate-500">BLS OEWS May 2024</p>
        </div>

        {/* Three quartile zones with hard breakpoints. Each zone is 25% wide so the
            visual maps directly to the percentile axis the marker uses. */}
        <div className="relative h-3 rounded-full overflow-hidden flex">
          <div className="h-full w-1/4 bg-amber-500/45" title="Below first quartile" />
          <div className="h-full w-1/4 bg-amber-400/35" title="Below median" />
          <div className="h-full w-1/4 bg-green-500/35" title="Above median" />
          <div className="h-full w-1/4 bg-green-500/55" title="Top quartile" />

          {/* Quartile boundary ticks */}
          {[25, 50, 75].map(p => (
            <div
              key={p}
              className="absolute top-0 bottom-0 w-px bg-slate-950/60"
              style={{ left: `${p}%` }}
              aria-hidden
            />
          ))}

          {/* You marker */}
          <div
            className="absolute -top-2 h-7 w-1 rounded-full bg-white shadow-lg"
            style={{ left: `calc(${markerLeft}% - 2px)` }}
            aria-label={`Your rate at ~${percentile}th percentile`}
          />
        </div>

        {/* Axis labels: we anchor the markers and let the bar fill explain the shading. */}
        <div className="mt-3 grid grid-cols-4 text-[10px] font-mono">
          <AxisLabel label="P25" value={`$${p25.toFixed(2)}`} align="left" />
          <AxisLabel label="Median" value={`$${median.toFixed(2)}`} align="center" emphasize />
          <AxisLabel label="P75" value={`$${p75.toFixed(2)}`} align="center" />
          <AxisLabel label="Top" value="" align="right" />
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
          <span>Bottom quartile</span>
          <span className="font-medium text-white nums">You · ${rate.toFixed(2)}/hr</span>
          <span>Top quartile</span>
        </div>

        {stateFallback && (
          <p className="mt-3 text-[11px] text-slate-500">
            No state-level data cached for this role; showing the national benchmark.
          </p>
        )}
      </section>

      <p className="text-[11px] text-slate-600 leading-relaxed">
        Source: BLS Occupational Employment &amp; Wage Statistics (OEWS), May 2024. Percentile is interpolated between
        the published 25th, 50th, and 75th quartile values for {stateFallback ? 'the national distribution' : stateCode}.
      </p>
    </div>
  )
}

function AxisLabel({ label, value, align, emphasize }) {
  const alignCls =
    align === 'center' ? 'items-center text-center' :
    align === 'right' ? 'items-end text-right' :
                        'items-start text-left'
  return (
    <div className={`flex flex-col ${alignCls}`}>
      <span className={`text-slate-500 uppercase ${emphasize ? 'text-slate-300' : ''}`}>{label}</span>
      {value && <span className={`mt-0.5 ${emphasize ? 'text-white' : 'text-slate-400'}`}>{value}</span>}
    </div>
  )
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)) }

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

const inputCls =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm nums focus:outline-none focus:border-terracotta'
