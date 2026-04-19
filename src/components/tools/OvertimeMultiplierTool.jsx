import { useMemo, useState } from 'react'
import { Timer, AlertTriangle, Info } from 'lucide-react'
import { computeOvertimeBreakdown, STATE_OT_RULES, getOtRule } from '../../lib/overtimeRules'
import { ToolHeader, Field } from './MarketRateTool'

/**
 * State-aware Overtime Multiplier. Pick a state, type seven daily hour values,
 * see what the state rule says belongs in regular / 1.5x / 2x buckets and what the
 * total pay should be at your hourly rate.
 *
 * Currently supports FL, TX, CA, NY plus a federal default fallback for everything else.
 */
const SUPPORTED_STATES = Object.keys(STATE_OT_RULES)
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function OvertimeMultiplierTool({ ctx }) {
  const defaultState = SUPPORTED_STATES.includes(ctx?.stateCode) ? ctx.stateCode : 'TX'
  const defaultRate = Number(ctx?.paystub?.hourly_rate) || 0

  const [stateCode, setStateCode] = useState(defaultState)
  const [hourlyRate, setHourlyRate] = useState(defaultRate || '')
  const [dailyHours, setDailyHours] = useState([0, 8, 8, 8, 8, 13, 0])

  const breakdown = useMemo(
    () => computeOvertimeBreakdown({
      dailyHours,
      stateCode,
      hourlyRate: Number(hourlyRate) || 0,
    }),
    [dailyHours, stateCode, hourlyRate],
  )

  const rule = getOtRule(stateCode)

  function setDay(i, value) {
    const next = [...dailyHours]
    next[i] = Math.max(0, Math.min(24, Number(value) || 0))
    setDailyHours(next)
  }

  function preset(label) {
    if (label === 'std40') setDailyHours([0, 8, 8, 8, 8, 8, 0])
    if (label === 'long6') setDailyHours([0, 10, 10, 10, 10, 10, 0])
    if (label === 'ca7day') setDailyHours([6, 8, 8, 8, 8, 8, 8])
    if (label === 'doublethirteen') setDailyHours([0, 8, 13, 8, 8, 8, 0])
  }

  return (
    <div>
      <ToolHeader
        icon={<Timer className="w-4 h-4" />}
        title="Overtime multiplier"
        subtitle="What your state really says about overtime, with the math worked out for the week you type in."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <Field label="State">
          <select
            value={stateCode}
            onChange={e => setStateCode(e.target.value)}
            className={inputCls}
          >
            {SUPPORTED_STATES.map(s => (
              <option key={s} value={s}>{STATE_OT_RULES[s].name} ({s})</option>
            ))}
          </select>
        </Field>
        <Field label="Hourly rate ($)">
          <input
            type="number"
            min="0"
            step="0.25"
            inputMode="decimal"
            value={hourlyRate}
            onChange={e => setHourlyRate(e.target.value)}
            placeholder="e.g. 22.50"
            className={inputCls}
          />
        </Field>
        <Field label="Quick presets">
          <div className="flex flex-wrap gap-1.5 pt-1">
            <PresetChip onClick={() => preset('std40')}>Mon-Fri 8h</PresetChip>
            <PresetChip onClick={() => preset('long6')}>5x10h weeks</PresetChip>
            <PresetChip onClick={() => preset('doublethirteen')}>1 long 13h day</PresetChip>
            <PresetChip onClick={() => preset('ca7day')}>7 days in a row</PresetChip>
          </div>
        </Field>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5">
        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-2">
          Daily hours
        </p>
        <div className="grid grid-cols-7 gap-2">
          {DAY_LABELS.map((d, i) => (
            <label key={d} className="block text-center">
              <span className="block text-[10px] text-slate-500 uppercase mb-1">{d}</span>
              <input
                type="number"
                min="0"
                max="24"
                step="0.25"
                value={dailyHours[i]}
                onChange={e => setDay(i, e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-2 py-2 text-sm nums text-center focus:outline-none focus:border-terracotta"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] font-medium text-terracotta uppercase tracking-[0.18em]">
              {breakdown.state} rule applied
            </p>
            <p className="mt-1 text-sm text-slate-100 leading-relaxed">{breakdown.summary}</p>
          </div>
          {breakdown.sevenDayRuleTriggered && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-300 px-2 py-1 rounded-full border border-amber-400/40 bg-amber-400/10">
              <AlertTriangle className="w-3 h-3" />
              7-day premium triggered
            </span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ResultTile label="Regular hours" value={breakdown.regularHours.toFixed(2)} />
          <ResultTile label="1.5x hours" value={breakdown.overtime15Hours.toFixed(2)} accent="terracotta" />
          <ResultTile label="2x hours" value={breakdown.overtime2Hours.toFixed(2)} accent="amber" />
          <ResultTile label="Total hours" value={breakdown.totalHours.toFixed(2)} muted />
        </div>

        {breakdown.pay && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <PayTile label="Regular" value={`$${breakdown.pay.regular.toFixed(2)}`} />
              <PayTile label="1.5x" value={`$${breakdown.pay.overtime15.toFixed(2)}`} />
              <PayTile label="2x" value={`$${breakdown.pay.overtime2.toFixed(2)}`} />
              <PayTile label="Owed total" value={`$${breakdown.pay.total.toFixed(2)}`} highlight />
            </div>
          </div>
        )}

        <p className="mt-4 text-[11px] text-slate-500 leading-relaxed flex items-start gap-2">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {rule.citation}. Educational estimate, not legal advice. State rules differ for residential
            employees, exempt workers, and alternative workweek schedules. Confirm with your handbook
            before relying on these numbers.
          </span>
        </p>
      </div>
    </div>
  )
}

function PresetChip({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[10px] font-medium px-2 py-1 rounded-full border border-slate-700 bg-slate-900 text-slate-300 hover:border-terracotta/50 hover:text-terracotta"
    >
      {children}
    </button>
  )
}

function ResultTile({ label, value, accent, muted }) {
  const cls =
    accent === 'terracotta' ? 'text-terracotta' :
    accent === 'amber' ? 'text-amber-300' :
    muted ? 'text-slate-300' : 'text-white'
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.14em]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold nums ${cls}`}>{value}</p>
    </div>
  )
}

function PayTile({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.14em]">{label}</p>
      <p className={`mt-1 text-base font-semibold nums ${highlight ? 'text-terracotta' : 'text-white'}`}>{value}</p>
    </div>
  )
}

const inputCls =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta'
