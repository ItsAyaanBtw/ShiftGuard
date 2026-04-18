import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle, CheckCircle2, ArrowRight, ArrowLeft, Clock,
  DollarSign, Scale, FileText, ExternalLink, ShieldAlert,
  TrendingDown, Gavel, AlertCircle, Info
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import AntiRetaliationInfo from '../components/AntiRetaliationInfo'
import { getShifts, getPaystub, getUserState, getUserCity, saveViolations } from '../lib/storage'
import { analyzeWages } from '../lib/comparisonEngine'

const VIOLATION_ICONS = {
  unpaid_overtime: Clock,
  unpaid_double_time: Clock,
  missing_hours: TrendingDown,
  minimum_wage: DollarSign,
  meal_break_violation: AlertCircle,
  rest_break_violation: AlertCircle,
  pay_discrepancy: AlertTriangle,
}

const VIOLATION_LABELS = {
  unpaid_overtime: 'Unpaid Overtime',
  unpaid_double_time: 'Unpaid Double Time',
  missing_hours: 'Missing Hours',
  minimum_wage: 'Minimum Wage Violation',
  meal_break_violation: 'Meal Break Violation',
  rest_break_violation: 'Rest Break Violation',
  pay_discrepancy: 'Pay Discrepancy',
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

  const shifts = useMemo(() => getShifts(), [])
  const paystub = useMemo(() => getPaystub(), [])
  const stateCode = useMemo(() => getUserState(), [])
  const city = useMemo(() => getUserCity(), [])

  useEffect(() => {
    if (!shifts.length || !paystub) return

    try {
      const analysis = analyzeWages({ shifts, paystub, stateCode, city })
      setResult(analysis)
      saveViolations(analysis)
    } catch (err) {
      console.error('Comparison engine error:', err)
      setError(err.message)
    }
  }, [shifts, paystub, stateCode])

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

  if (!result) return null

  const hasViolations = result.violations.length > 0

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Status banner */}
        {hasViolations ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-4">
              <ShieldAlert className="w-8 h-8 text-red-400 shrink-0 mt-0.5" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-white mb-1">
                  Potential violations detected
                </h1>
                <p className="text-slate-400 text-sm">
                  We found {result.violations.length} discrepanc{result.violations.length === 1 ? 'y' : 'ies'} between
                  your logged shifts and your pay stub under {result.state.name} labor law.
                </p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-bold text-red-400">
                    ${result.totalOwed.toFixed(2)}
                  </span>
                  <span className="text-slate-400 text-sm">estimated amount owed</span>
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
                  No violations detected
                </h1>
                <p className="text-slate-400 text-sm">
                  Your pay stub appears to match your logged shifts under {result.state.name} labor law.
                  This is a good sign, but review the details below to confirm.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Side-by-side comparison */}
        <SideBySide summary={result.summary} paystub={paystub} stateCode={stateCode} />

        {/* Violations */}
        {hasViolations && (
          <div className="mt-6">
            <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <Scale className="w-5 h-5 text-terracotta" />
              Violations
            </h2>
            <div className="space-y-3">
              {result.violations.map((v, i) => (
                <ViolationCard key={i} violation={v} />
              ))}
            </div>
          </div>
        )}

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

        {/* Recommended action */}
        {hasViolations && (
          <div className="mt-6">
            <RecommendedAction action={result.recommendedAction} agency={result.state.agency} />
          </div>
        )}

        {/* Salaried-exempt warning */}
        {paystub.hourly_rate >= 21.10 && (
          <div className="mt-6 flex items-start gap-2 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-400 leading-relaxed">
              Your hourly rate of ${paystub.hourly_rate.toFixed(2)} is above the FLSA salary threshold
              for overtime exemption ($844/week). If you are classified as a salaried-exempt employee,
              overtime rules may not apply to your position. Consult an attorney to determine your
              classification status.
            </p>
          </div>
        )}

        {/* Anti-retaliation info */}
        {hasViolations && (
          <div className="mt-6">
            <AntiRetaliationInfo stateCode={stateCode} />
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/upload')}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Re-upload pay stub
          </button>
          {hasViolations && (
            <button
              onClick={() => navigate('/action')}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Take action
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>

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

/* ---------- Side-by-Side ---------- */

function SideBySide({ summary, paystub, stateCode }) {
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
    {
      label: 'Expected gross pay',
      worked: `$${summary.expectedGross.toFixed(2)}`,
      paid: `$${summary.actualGross.toFixed(2)}`,
      mismatch: Math.abs(summary.discrepancy) > 1,
      isBold: true,
    },
  )

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

/* ---------- Violation Card ---------- */

function ViolationCard({ violation }) {
  const Icon = VIOLATION_ICONS[violation.type] || AlertTriangle
  const label = VIOLATION_LABELS[violation.type] || violation.type
  const style = SEVERITY_STYLES[violation.severity] || SEVERITY_STYLES.medium
  const dot = SEVERITY_DOT[violation.severity] || SEVERITY_DOT.medium

  return (
    <div className={`border rounded-xl p-4 ${style}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">{label}</h3>
              <span className={`w-2 h-2 rounded-full ${dot}`} />
            </div>
            <span className="text-base font-bold text-white shrink-0">
              ${violation.dollarAmount.toFixed(2)}
            </span>
          </div>
          <p className="text-sm leading-relaxed opacity-90">{violation.explanation}</p>
          <p className="text-xs mt-2 opacity-70 font-medium">
            <Gavel className="w-3 h-3 inline-block mr-1 -mt-0.5" />
            {violation.citation}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------- Recommended Action ---------- */

function RecommendedAction({ action, agency }) {
  const configs = {
    demand_letter: {
      title: 'Send a demand letter',
      desc: 'For smaller discrepancies, a formal demand letter to your employer is often the fastest path to resolution.',
      icon: FileText,
    },
    state_complaint: {
      title: `File a complaint with ${agency.name}`,
      desc: 'The amount owed is significant enough to warrant a formal state complaint.',
      icon: Scale,
    },
    attorney_referral: {
      title: 'Consult an employment attorney',
      desc: 'The violations detected are substantial. An attorney can help you recover the full amount owed, and under the FLSA, the employer typically pays attorney fees.',
      icon: Gavel,
    },
  }

  const config = configs[action]
  if (!config) return null
  const Icon = config.icon

  return (
    <div className="bg-terracotta/10 border border-terracotta/20 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-terracotta shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-white text-sm mb-1">
            Recommended: {config.title}
          </h3>
          <p className="text-sm text-slate-400 leading-relaxed">{config.desc}</p>
          {agency.url && (
            <a
              href={agency.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-terracotta hover:text-terracotta-light mt-2 font-medium"
            >
              {agency.name}
              <ExternalLink className="w-3 h-3" />
            </a>
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
