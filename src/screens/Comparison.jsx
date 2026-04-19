import { useState, useEffect, useReducer } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Clock,
  DollarSign, Scale, ShieldAlert, ShieldCheck, Mail, Wrench,
  TrendingDown, AlertCircle, Info
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import CaseIntelligence from '../components/CaseIntelligence'
import {
  getShifts,
  getPaystub,
  getUserState,
  getUserCity,
  saveViolations,
  getUserPreferences,
  getVerificationRunCountThisMonth,
  isProPlan,
  getTimesheetRecord,
  FREE_MONTHLY_CHECK_LIMIT,
  getAnomalies,
  dismissAnomaly,
} from '../lib/storage'
import { analyzeWages } from '../lib/comparisonEngine'

const DISCREPANCY_ICONS = {
  overtime_shortfall: Clock,
  unpaid_overtime: Clock,
  double_time_shortfall: Clock,
  unpaid_double_time: Clock,
  hours_shortfall: TrendingDown,
  missing_hours: TrendingDown,
  minimum_wage_review: DollarSign,
  minimum_wage: DollarSign,
  meal_break_review: AlertCircle,
  meal_break_violation: AlertCircle,
  rest_break_review: AlertCircle,
  rest_break_violation: AlertCircle,
  gross_pay_review: AlertTriangle,
  pay_discrepancy: AlertTriangle,
  night_differential_review: Clock,
  weekend_premium_review: Clock,
  holiday_premium_review: Clock,
  charge_nurse_differential_review: Clock,
  preceptor_differential_review: Clock,
}

const DISCREPANCY_LABELS = {
  overtime_shortfall: 'Overtime premium',
  unpaid_overtime: 'Overtime premium',
  double_time_shortfall: 'Double-time premium',
  unpaid_double_time: 'Double-time premium',
  hours_shortfall: 'Hours on pay advice',
  missing_hours: 'Hours on pay advice',
  minimum_wage_review: 'Minimum wage check',
  minimum_wage: 'Minimum wage check',
  meal_break_review: 'Meal break timing',
  meal_break_violation: 'Meal break timing',
  rest_break_review: 'Rest break timing',
  rest_break_violation: 'Rest break timing',
  gross_pay_review: 'Gross pay gap',
  pay_discrepancy: 'Gross pay gap',
  night_differential_review: 'Night / evening differential',
  weekend_premium_review: 'Weekend premium',
  holiday_premium_review: 'Holiday premium',
  charge_nurse_differential_review: 'Charge nurse differential',
  preceptor_differential_review: 'Preceptor differential',
}

const SEVERITY_STYLES = {
  high: 'bg-red-500/10 border-red-500/30 text-red-400',
  medium: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  low: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
}

const SEVERITY_DOT = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-yellow-500',
}

export default function Comparison() {
  const navigate = useNavigate()
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dataVersion, bumpDataVersion] = useReducer(n => n + 1, 0)

  useEffect(() => {
    const onData = () => bumpDataVersion()
    window.addEventListener('shiftguard-data-changed', onData)
    return () => window.removeEventListener('shiftguard-data-changed', onData)
  }, [])

  const shifts = getShifts()
  const paystub = getPaystub()
  const stateCode = getUserState()

  useEffect(() => {
    const t = window.setTimeout(() => {
      const s = getShifts()
      const p = getPaystub()
      const sc = getUserState()
      const cy = getUserCity()
      if (!s.length || !p) {
        setResult(null)
        setError(null)
        return
      }
      try {
        const analysis = analyzeWages({
          shifts: s,
          paystub: p,
          stateCode: sc,
          city: cy,
          prefs: getUserPreferences(),
        })
        setResult(analysis)
        saveViolations(analysis)
        setError(null)
      } catch (err) {
        console.error('Comparison engine error:', err)
        setError(err.message)
        setResult(null)
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [dataVersion])

  if (!shifts.length || !paystub) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col">
        <Header />
        <MissingDataPrompt hasShifts={shifts.length > 0} hasPaystub={!!paystub} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-white font-medium mb-2">Analysis failed</p>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <button
              onClick={() => navigate('/log')}
              className="px-6 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm cursor-pointer"
            >
              Back to shifts
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!result && !error) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col">
        <Header />
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-3">
          <div className="w-8 h-8 border-2 border-terracotta border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Running paycheck comparison…</p>
        </div>
      </div>
    )
  }

  const hasDiscrepancies = result.discrepancies.length > 0

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 pb-20">
        <AnomaliesBanner />
        <VerificationCoverageBanner shifts={shifts} />

        {!isProPlan() && getVerificationRunCountThisMonth() > FREE_MONTHLY_CHECK_LIMIT && (
          <div className="mb-5 rounded-xl border border-slate-600 bg-slate-900/90 px-4 py-3 text-sm text-slate-300">
            <span className="text-slate-400">Free plan: </span>
            {FREE_MONTHLY_CHECK_LIMIT} paycheck checks per month is the launch cap. This device has{' '}
            {getVerificationRunCountThisMonth()} runs in {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}.
            {' '}
            <Link to="/pricing" className="text-terracotta hover:underline font-medium">
              Activate Pro (demo)
            </Link>{' '}
            turns on unlimited runs here for your pitch and testing.
          </div>
        )}

        {/* Status banner */}
        {hasDiscrepancies ? (
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              <ShieldAlert className="w-8 h-8 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
                  Paycheck discrepancies to review
                </h1>
                <p className="text-slate-400 text-sm">
                  We found {result.discrepancies.length} line item{result.discrepancies.length === 1 ? '' : 's'} comparing
                  your shift log to your pay advice using common {result.state.name} and federal pay rules.
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-amber-400">
                    ${result.totalDifference.toFixed(2)}
                  </span>
                  <span className="text-slate-400 text-sm">combined dollars flagged (estimate)</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-400 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
                  No discrepancies flagged
                </h1>
                <p className="text-slate-400 text-sm">
                  Your pay advice lines up with your logged hours under the checks we run for {result.state.name}.
                  Still verify rates, differentials, and pay-period dates against your employer’s policy.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Side-by-side comparison */}
        <SideBySide summary={result.summary} paystub={paystub} />

        {/* Discrepancies */}
        {hasDiscrepancies && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Scale className="w-5 h-5 text-terracotta" />
              What we noticed
            </h2>
            <div className="space-y-3">
              {result.discrepancies.map((v, i) => (
                <DiscrepancyCard key={i} item={v} />
              ))}
            </div>
          </div>
        )}

        <CaseIntelligence
          shifts={shifts}
          paystub={paystub}
          violations={result.discrepancies}
          stateCode={stateCode}
          totalOwed={result.totalDifference}
        />

        {/* Daily breakdown */}
        {result.summary.dailyBreakdown?.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Clock className="w-5 h-5 text-terracotta" />
              Daily breakdown
            </h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="text-left text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Date</th>
                    <th className="text-right text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Hours</th>
                    {stateCode === 'CA' && (
                      <>
                        <th className="text-right text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">Reg</th>
                        <th className="text-right text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">OT</th>
                        <th className="text-right text-slate-500 font-medium px-4 py-2.5 text-xs uppercase tracking-wider">DT</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {result.summary.dailyBreakdown.map((d, i) => {
                    const dateObj = new Date(d.date + 'T00:00:00')
                    const label = dateObj.toLocaleDateString('en-US', {
                      weekday: 'short', month: 'short', day: 'numeric'
                    })
                    const isLong = d.hours > 8
                    return (
                      <tr key={i} className="border-b border-slate-800/50 last:border-0">
                        <td className="px-4 py-2.5 text-slate-300">{label}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${isLong ? 'text-amber-400' : 'text-white'}`}>
                          {d.hours.toFixed(1)}h
                        </td>
                        {stateCode === 'CA' && (
                          <>
                            <td className="px-4 py-2.5 text-right text-slate-400">{d.regular?.toFixed(1) ?? d.hours.toFixed(1)}</td>
                            <td className="px-4 py-2.5 text-right text-amber-400">{(d.ot || 0).toFixed(1)}</td>
                            <td className="px-4 py-2.5 text-right text-red-400">{(d.dt || 0).toFixed(1)}</td>
                          </>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Salaried-exempt warning */}
        {paystub.hourly_rate >= 21.10 && (
          <div className="mt-6 flex items-start gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400 leading-relaxed">
              Your hourly rate of ${paystub.hourly_rate.toFixed(2)} is above the FLSA salary threshold
              for overtime exemption ($844/week). If you are classified as a salaried-exempt employee,
              overtime rules may not apply to your position. Confirm your classification with payroll if hours look wrong.
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/upload')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Re-upload pay stub
          </button>
          <button
            onClick={() => navigate('/tools')}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-terracotta/40 text-terracotta hover:bg-terracotta/10 transition-colors text-sm font-medium cursor-pointer"
          >
            <Mail className="w-4 h-4" />
            Draft inquiry email
          </button>
          <button
            onClick={() => navigate('/report')}
            className="flex items-center justify-center gap-2 py-3 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Open the report
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        {/* Upsell: only if discrepancies found and user is Free */}
        {hasDiscrepancies && !isProPlan() && (
          <div className="mt-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-4 flex items-start gap-3">
            <Wrench className="w-4 h-4 text-terracotta mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium">Take the next step</p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Pro at $6.99/month (or $59/year) opens the inquiry email composer, PTO value,
                volatility score, travel-nurse X-ray, retro pay estimate, and the full CA/NY rule pack.
                Affected workers lose about $3,300/year to pay errors on average, so Pro pays for itself
                on the first catch.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:text-terracotta-light"
                >
                  See plans
                  <ArrowRight className="w-3 h-3" />
                </Link>
                <Link
                  to="/tools"
                  className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white"
                >
                  Try free tools
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 leading-relaxed">
              This analysis compares your self-reported shift data against your pay stub using {result.state.name} labor law.
              Results are estimates and should be reviewed carefully. Discrepancies may have legitimate explanations
              (e.g., pay period boundaries, pre-tax deductions, rounding).
            </p>
          </div>
        </div>

        <div className="mt-4">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

/* ---------- Continuous wage-check alerts ---------- */

function AnomaliesBanner() {
  const active = getAnomalies().filter(a => !a.dismissed).slice(0, 3)
  if (!active.length) return null

  const severityTone = (s) =>
    s === 'alert' ? 'border-red-500/30 bg-red-500/5 text-red-200' :
    s === 'warn'  ? 'border-amber-500/30 bg-amber-500/5 text-amber-100' :
                    'border-slate-700 bg-slate-900/60 text-slate-200'

  return (
    <div className="mb-5 space-y-2">
      {active.map(a => (
        <div
          key={a.id}
          className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${severityTone(a.severity)}`}
        >
          <ShieldAlert className={`w-5 h-5 shrink-0 mt-0.5 ${a.severity === 'alert' ? 'text-red-400' : 'text-amber-300'}`} />
          <div className="flex-1 min-w-0 text-sm">
            <p className="font-medium text-white">{a.title}</p>
            <p className="text-xs opacity-90 mt-1 leading-relaxed">{a.detail}</p>
          </div>
          <button
            type="button"
            onClick={() => { dismissAnomaly(a.id); window.dispatchEvent(new Event('shiftguard-data-changed')) }}
            className="text-[11px] text-slate-300 hover:text-white px-2 py-0.5 rounded border border-slate-700 hover:border-slate-600 shrink-0"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  )
}

/* ---------- Verification coverage banner ---------- */

function VerificationCoverageBanner({ shifts }) {
  const ts = getTimesheetRecord()
  const hasTimesheet = !!(ts && Array.isArray(ts.entries) && ts.entries.length)
  const verified = shifts.filter(s => s?.verification?.status === 'verified').length
  const mismatch = shifts.filter(s => s?.verification?.status === 'mismatch').length
  const pct = shifts.length ? Math.round((verified / shifts.length) * 100) : 0

  if (!hasTimesheet) {
    return (
      <div className="mb-5 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium">These results use self-reported hours</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Upload a Kronos, UKG, Workday, ADP, or similar time record so each shift is matched
            to an employer-issued entry before the paycheck comparison runs.
          </p>
          <Link
            to="/verify"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:text-terracotta-light"
          >
            Verify hours
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    )
  }

  const allClean = mismatch === 0 && verified === shifts.length
  const tone = allClean
    ? 'border-green-500/30 bg-green-500/10 text-green-200'
    : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
  const Icon = allClean ? ShieldCheck : ShieldAlert

  return (
    <div className={`mb-5 rounded-xl border px-4 py-3 flex items-start gap-3 ${tone}`}>
      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0 text-sm">
        <p className="font-medium text-white">
          {verified} of {shifts.length} shifts verified
          {pct > 0 && <span className="text-slate-400 font-normal"> · {pct}% coverage</span>}
          {mismatch > 0 && <span className="text-amber-300 font-normal"> · {mismatch} off by a bit</span>}
        </p>
        <p className="text-xs opacity-90 mt-1 leading-relaxed">
          Source: {ts.source_label || 'Employer time record'}
          {ts.period_start && ts.period_end && <> · {ts.period_start} to {ts.period_end}</>}.
          {' '}<Link to="/verify" className="underline underline-offset-2 hover:opacity-80">Open</Link>
        </p>
      </div>
    </div>
  )
}

/* ---------- Side-by-Side ---------- */

function SideBySide({ summary, paystub }) {
  const rows = [
    {
      label: 'Total hours',
      worked: `${summary.totalHoursWorked.toFixed(1)}h`,
      paid: `${(paystub.hours_paid + paystub.overtime_hours_paid).toFixed(1)}h`,
      mismatch: Math.abs(summary.totalHoursWorked - paystub.hours_paid - paystub.overtime_hours_paid) > 0.25,
    },
    {
      label: 'Regular hours',
      worked: `${summary.regularHours.toFixed(1)}h`,
      paid: `${paystub.hours_paid.toFixed(1)}h`,
      mismatch: Math.abs(summary.regularHours - paystub.hours_paid) > 0.25,
    },
    {
      label: 'Overtime hours',
      worked: `${summary.overtimeHours.toFixed(1)}h`,
      paid: `${paystub.overtime_hours_paid.toFixed(1)}h`,
      mismatch: Math.abs(summary.overtimeHours - paystub.overtime_hours_paid) > 0.25,
    },
  ]

  if (summary.doubleTimeHours > 0) {
    rows.push({
      label: 'Double time hours',
      worked: `${summary.doubleTimeHours.toFixed(1)}h`,
      paid: '0.0h',
      mismatch: true,
    })
  }

  rows.push(
    {
      label: 'Hourly rate',
      worked: `$${summary.hourlyRate.toFixed(2)}`,
      paid: `$${paystub.hourly_rate.toFixed(2)}`,
      mismatch: false,
    },
  )

  if (summary.healthcarePremiums > 0.01) {
    rows.push({
      label: 'Healthcare premiums (your entries)',
      worked: `+$${summary.healthcarePremiums.toFixed(2)}`,
      paid: 'not shown',
      mismatch: false,
    })
  }

  rows.push({
    label: 'Expected gross pay',
    worked: `$${summary.expectedGross.toFixed(2)}`,
    paid: `$${summary.actualGross.toFixed(2)}`,
    mismatch: Math.abs(summary.discrepancy) > 1,
    isBold: true,
  })

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-3 gap-4 px-4 py-3 border-b border-slate-800 bg-slate-800/50">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider" />
        <div className="text-xs font-medium text-terracotta uppercase tracking-wider text-center">
          What you worked
        </div>
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider text-center">
          What you were paid
        </div>
      </div>

      {/* Data rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          className={`grid grid-cols-3 gap-4 px-4 py-3 items-center ${
            i < rows.length - 1 ? 'border-b border-slate-800/50' : ''
          } ${row.mismatch ? 'bg-red-500/5' : ''}`}
        >
          <div className={`text-sm ${row.isBold ? 'text-white font-semibold' : 'text-slate-400'}`}>
            {row.label}
          </div>
          <div className={`text-center text-sm font-medium ${row.isBold ? 'text-white text-base' : 'text-terracotta'}`}>
            {row.worked}
          </div>
          <div className="text-center flex items-center justify-center gap-2">
            <span className={`text-sm font-medium ${row.mismatch ? 'text-red-400' : row.isBold ? 'text-white text-base' : 'text-slate-300'}`}>
              {row.paid}
            </span>
            {row.mismatch && <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          </div>
        </div>
      ))}

      {/* Discrepancy footer */}
      {Math.abs(summary.discrepancy) > 0.01 && (
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-800/30 flex items-center justify-between">
          <span className="text-sm text-slate-400">Discrepancy</span>
          <span className={`text-sm font-bold ${summary.discrepancy > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {summary.discrepancy > 0 ? '-' : '+'}${Math.abs(summary.discrepancy).toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}

/* ---------- Discrepancy Card ---------- */

function DiscrepancyCard({ item }) {
  const Icon = DISCREPANCY_ICONS[item.type] || AlertTriangle
  const label = DISCREPANCY_LABELS[item.type] || item.type.replace(/_/g, ' ')
  const style = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.medium
  const dot = SEVERITY_DOT[item.severity] || SEVERITY_DOT.medium
  const amt = Number(item.difference ?? item.dollarAmount ?? 0)

  return (
    <div className={`border rounded-xl p-4 ${style}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm capitalize">{label}</h3>
              <span className={`w-2 h-2 rounded-full ${dot}`} />
            </div>
            <span className="text-base font-bold text-white shrink-0">
              ${amt.toFixed(2)}
            </span>
          </div>
          <p className="text-sm leading-relaxed opacity-90">{item.explanation}</p>
          {item.suggestedAction && (
            <p className="text-xs mt-2 text-slate-300/90 leading-relaxed">
              <span className="font-medium text-slate-400">Next step: </span>
              {item.suggestedAction}
            </p>
          )}
          {item.lawNote && (
            <p className="text-[11px] mt-2 opacity-70">
              Reference: {item.lawNote}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------- Missing Data Prompt ---------- */

function MissingDataPrompt({ hasShifts, hasPaystub }) {
  const navigate = useNavigate()

  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <Scale className="w-12 h-12 text-slate-700 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Need more data to compare</h2>
        <p className="text-slate-400 text-sm mb-6">
          {!hasShifts && !hasPaystub
            ? 'Log your shifts and upload a pay stub to run the comparison.'
            : !hasShifts
            ? 'Log your shifts first, then come back to compare.'
            : 'Upload your pay stub, then come back to compare.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!hasShifts && (
            <button
              onClick={() => navigate('/log')}
              className="px-6 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-medium cursor-pointer"
            >
              Log shifts
            </button>
          )}
          {!hasPaystub && (
            <button
              onClick={() => navigate('/upload')}
              className="px-6 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-medium cursor-pointer"
            >
              Upload pay stub
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
