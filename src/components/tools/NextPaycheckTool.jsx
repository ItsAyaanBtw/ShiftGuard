import { useMemo, useState } from 'react'
import { CalendarClock, Info, Bell } from 'lucide-react'
import {
  getShifts, getUserPreferences, saveUserPreferences,
} from '../../lib/storage'
import { nextPayday, daysUntil, formatShortDate } from '../../lib/payCycle'
import { calcShiftHours } from '../../lib/utils'
import { estimateTakeHome } from '../../lib/taxEstimator'
import { ToolHeader, Field } from './MarketRateTool'

/**
 * Next-payday planner. Projects the upcoming paycheck from shift hours + pay cycle,
 * and shows estimated gross / net. Pay-frequency selection writes back to prefs so the
 * Dashboard widget can use it without re-asking.
 */

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'semimonthly', label: 'Semi-monthly' },
  { value: 'monthly', label: 'Monthly' },
]

export default function NextPaycheckTool({ ctx }) {
  const prefs = ctx?.preferences || getUserPreferences()
  const paystub = useMemo(() => ctx?.paystub || {}, [ctx?.paystub])

  const [payFrequency, setFrequency] = useState(prefs.payFrequency || 'biweekly')
  const [lastPayDate, setLastPayDate] = useState(prefs.lastPayDate || paystub.pay_date || paystub.pay_period_end || '')
  const [hourlyRate, setHourlyRate] = useState(Number(paystub.hourly_rate) || 0)

  function persistPrefs(partial) {
    saveUserPreferences({ ...prefs, ...partial })
  }

  const next = useMemo(
    () => nextPayday({ payFrequency, lastPayDate, paystub }),
    [payFrequency, lastPayDate, paystub],
  )

  // Project hours for the current window: sum of logged shifts since lastPayDate.
  const projectedHours = useMemo(() => {
    const shifts = getShifts()
    if (!shifts.length) return 0
    const cutoff = lastPayDate || ''
    return shifts
      .filter(s => (cutoff ? s.date > cutoff : true))
      .reduce((sum, s) => sum + calcShiftHours(s), 0)
  }, [lastPayDate])

  const projectedGross = Number(hourlyRate) > 0 ? projectedHours * Number(hourlyRate) : 0
  const take = estimateTakeHome({
    grossThisCheck: projectedGross,
    annualizeOver: payFrequency,
    stateCode: ctx?.stateCode || 'TX',
    filingStatus: prefs.filingStatus || 'single',
    dependents: prefs.dependents || 0,
  })

  const daysAway = next ? daysUntil(next) : null

  return (
    <div>
      <ToolHeader
        icon={<CalendarClock className="w-4 h-4" />}
        title="Next paycheck planner"
        subtitle="When it lands, how big it looks, and what you'll actually see after tax."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
        <Field label="Pay frequency">
          <select
            value={payFrequency}
            onChange={e => { setFrequency(e.target.value); persistPrefs({ payFrequency: e.target.value }) }}
            className={inputCls}
          >
            {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Last pay date">
          <input
            type="date"
            value={lastPayDate}
            onChange={e => { setLastPayDate(e.target.value); persistPrefs({ lastPayDate: e.target.value }) }}
            className={inputCls}
          />
        </Field>
        <Field label="Base hourly rate ($)">
          <input
            type="number"
            min="0"
            step="0.25"
            value={hourlyRate}
            onChange={e => setHourlyRate(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5">
          <p className="text-[11px] font-medium text-terracotta uppercase tracking-[0.18em]">Next payday</p>
          <p className="mt-1 text-3xl sm:text-4xl font-semibold text-white nums">
            {next ? formatShortDate(next) : 'Set a pay cycle'}
          </p>
          <p className="text-sm text-slate-300 mt-1">
            {next
              ? daysAway === 0 ? 'Today'
                : daysAway === 1 ? 'Tomorrow'
                : daysAway && daysAway > 0 ? `in ${daysAway} days`
                : daysAway && daysAway < 0 ? `${Math.abs(daysAway)} days ago`
                : ''
              : 'Set a last pay date to project.'}
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 border border-slate-800 px-2.5 py-1 text-[11px] text-slate-300">
            <Bell className="w-3 h-3 text-terracotta" />
            We&rsquo;ll remind you in the dashboard 2 days before.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">Projected this period</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Box label="Hours" value={projectedHours.toFixed(1)} />
            <Box label="Gross" value={`$${projectedGross.toFixed(2)}`} />
            <Box label="Take-home" value={`$${take.net.toFixed(2)}`} tone="terracotta" />
          </div>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed">
            Projection pulls hours from shifts logged after your last pay date, multiplied by your base
            rate. Use the Take-home estimator for pre-tax benefit scenarios.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-start gap-2 text-xs text-slate-400 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
        <span>
          Weekly + biweekly reminders project from your last pay date. Semi-monthly defaults to the 15th
          and last day of each month. Monthly uses the same day-of-month as your last pay date.
        </span>
      </div>
    </div>
  )
}

function Box({ label, value, tone }) {
  const cls = tone === 'terracotta' ? 'text-terracotta' : 'text-white'
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.14em]">{label}</p>
      <p className={`mt-0.5 text-base font-semibold nums ${cls}`}>{value}</p>
    </div>
  )
}

const inputCls =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm nums focus:outline-none focus:border-terracotta'
