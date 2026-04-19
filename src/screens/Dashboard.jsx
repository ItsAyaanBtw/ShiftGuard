import { useEffect, useReducer, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, AlertTriangle,
  ShieldAlert, ArrowRight, CheckCircle2, Camera, GitCompareArrows, FileText,
  CalendarClock, Bell, Receipt, Briefcase, Clock as ClockIcon, Car, Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import {
  getViolations,
  getUserState,
  getVerifiedPaycheckCount,
  getUserPreferences,
  getPaystub,
  getPaystubVault,
  getAnomalies,
  getShifts,
} from '../lib/storage'
import { normalizeAnalysis } from '../lib/analysisUtils'
import { nextPayday, daysUntil, formatShortDate } from '../lib/payCycle'
import { estimateTakeHome } from '../lib/taxEstimator'
import { windowForTimeframe, totalsForWindow, monthHeatmap } from '../lib/shiftWindows'
import stateLaws from '../data/stateLaws'

const SEVERITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#eab308' }

export default function Dashboard() {
  const navigate = useNavigate()
  const [, refresh] = useReducer(i => i + 1, 0)

  useEffect(() => {
    const onData = () => refresh()
    window.addEventListener('shiftguard-data-changed', onData)
    return () => window.removeEventListener('shiftguard-data-changed', onData)
  }, [])

  const violationData = getViolations()
  const analysis = normalizeAnalysis(violationData)
  const stateCode = getUserState()
  const state = stateLaws[stateCode]
  const prefs = getUserPreferences()
  const verifiedCount = getVerifiedPaycheckCount()

  const hasAnalysis = !!(analysis?.summary)
  const hasDiscrepancies = hasAnalysis && analysis.discrepancies.length > 0

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <OverviewSection prefs={prefs} />

        <TimeframeTotals />

        <DiscrepancyBanner analysis={analysis} />


        <PayPictureGrid />

        <InsightsStrip prefs={prefs} stateCode={stateCode} />

        {/* Personal stats */}
        {hasDiscrepancies ? (
          <PersonalSection
            analysis={analysis}
            verifiedCount={verifiedCount}
            healthcareMode={!!prefs.healthcareMode}
            onReport={() => navigate('/report')}
          />
        ) : hasAnalysis ? (
          <PersonalClearSection
            analysis={analysis}
            stateName={state?.name}
            verifiedCount={verifiedCount}
            onViewCompare={() => navigate('/compare')}
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 text-center">
            <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">No personal analysis yet</p>
            <p className="text-slate-500 text-sm mb-4">
              Log shifts and upload a pay stub to see your personal impact stats here.
            </p>
            <button
              type="button"
              onClick={() => navigate('/log')}
              className="px-5 py-2 rounded-lg bg-terracotta hover:bg-terracotta-dark text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Get started
            </button>
          </div>
        )}

        <Disclaimer />
      </main>
    </div>
  )
}

/* ---------- Personal Section ---------- */

function PersonalClearSection({ analysis, stateName, verifiedCount, onViewCompare }) {
  const { summary, totalDifference } = analysis
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <CheckCircle2 className="w-5 h-5 text-green-400" />
        <h2 className="text-lg font-semibold text-white">Your analysis</h2>
      </div>
      <div className="bg-green-500/10 border border-green-500/25 rounded-xl p-6 mb-4">
        <p className="text-white font-medium mb-1">No discrepancies flagged</p>
        <p className="text-slate-400 text-sm leading-relaxed mb-4">
          For {stateName || 'your state'}, ShiftGuard did not find discrepancies between your shift log and pay stub under the rules we model.
          Double-check pay period dates and rates if something still feels wrong.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Dollars flagged"
            value={`$${Number(totalDifference || 0).toFixed(2)}`}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Paychecks verified"
            value={String(verifiedCount)}
          />
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Hours worked"
            value={`${summary.totalHoursWorked.toFixed(1)}h`}
          />
          <StatCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Paid gross"
            value={`$${summary.actualGross.toFixed(2)}`}
          />
        </div>
        <button
          type="button"
          onClick={onViewCompare}
          className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-600 text-slate-200 hover:bg-slate-800 transition-colors text-sm font-medium cursor-pointer"
        >
          Open comparison details <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function PersonalSection({ analysis, verifiedCount, healthcareMode, onReport }) {
  const { discrepancies, totalDifference, summary } = analysis
  const highCount = discrepancies.filter(v => v.severity === 'high').length
  const medCount = discrepancies.filter(v => v.severity === 'medium').length
  const lowCount = discrepancies.filter(v => v.severity === 'low').length

  const severityData = [
    highCount > 0 && { name: 'High', value: highCount, color: SEVERITY_COLORS.high },
    medCount > 0 && { name: 'Medium', value: medCount, color: SEVERITY_COLORS.medium },
    lowCount > 0 && { name: 'Low', value: lowCount, color: SEVERITY_COLORS.low },
  ].filter(Boolean)

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <ShieldAlert className="w-5 h-5 text-terracotta" />
        <h2 className="text-lg font-semibold text-white">Your Analysis</h2>
      </div>

      {/* Personal stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Dollars flagged"
          value={`$${totalDifference.toFixed(2)}`}
          highlight
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Line items"
          value={discrepancies.length}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Paychecks verified"
          value={String(verifiedCount)}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Hours worked"
          value={`${summary.totalHoursWorked.toFixed(1)}h`}
        />
      </div>

      {(healthcareMode && (summary.healthcarePremiums ?? 0) > 0) && (
        <p className="text-sm text-slate-400 mb-4 leading-relaxed">
          This run modeled about{' '}
          <span className="text-white font-medium">${summary.healthcarePremiums.toFixed(2)}</span> in healthcare premiums
          from your shift flags (night, weekend, holiday). Compare those lines on your actual pay advice.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Modeled gross"
          value={`$${summary.expectedGross.toFixed(2)}`}
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Paid gross"
          value={`$${summary.actualGross.toFixed(2)}`}
        />
      </div>

      {/* Personal charts row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        {/* Hours breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Hours breakdown</p>
          <div className="space-y-2">
            <HoursBar label="Regular" hours={summary.regularHours} total={summary.totalHoursWorked} color="bg-slate-500" />
            <HoursBar label="Overtime" hours={summary.overtimeHours} total={summary.totalHoursWorked} color="bg-amber-500" />
            {summary.doubleTimeHours > 0 && (
              <HoursBar label="Double time" hours={summary.doubleTimeHours} total={summary.totalHoursWorked} color="bg-red-500" />
            )}
          </div>
        </div>

        {/* Severity breakdown */}
        {severityData.length > 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Severity mix</p>
            <div className="flex items-center justify-center h-[calc(100%-2rem)]">
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie
                    data={severityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={50}
                    dataKey="value"
                    paddingAngle={4}
                    stroke="none"
                  >
                    {severityData.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8 }}
                    formatter={(v, name) => [v, name]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span style={{ color: '#b0b0be', fontSize: 12 }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onReport}
        className="w-full flex items-center justify-center gap-2 py-3 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
      >
        Open paycheck report (${totalDifference.toFixed(2)} flagged)
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

/* ---------- Insights strip ---------- */

function TimeframeTotals() {
  const [timeframe, setTimeframe] = useState('week')
  const [, bump] = useReducer(n => n + 1, 0)
  useEffect(() => {
    const on = () => bump()
    window.addEventListener('shiftguard-data-changed', on)
    return () => window.removeEventListener('shiftguard-data-changed', on)
  }, [])

  const shifts = getShifts()
  const range = useMemo(() => windowForTimeframe(timeframe), [timeframe])
  const totals = useMemo(() => totalsForWindow(shifts, range), [shifts, range])
  const heatmap = useMemo(() => (timeframe === 'month' ? monthHeatmap(shifts) : null), [shifts, timeframe])

  return (
    <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Your shifts</p>
          <p className="text-lg font-semibold text-white">{range.label}</p>
        </div>
        <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 p-1 text-xs">
          {['day', 'week', 'month'].map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1 rounded-full font-medium transition-colors ${
                timeframe === t ? 'bg-terracotta text-white' : 'text-slate-300 hover:text-white'
              }`}
              aria-pressed={timeframe === t}
            >
              {t === 'day' ? 'Today' : t === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <TimeTile icon={<ClockIcon className="w-3.5 h-3.5" />} label="Hours" value={totals.hours.toFixed(1)} />
        <TimeTile icon={<Briefcase className="w-3.5 h-3.5" />} label="Shifts" value={String(totals.count)} />
        <TimeTile icon={<DollarSign className="w-3.5 h-3.5" />} label="Tips" value={`$${totals.tips.toFixed(2)}`} />
        <TimeTile icon={<Car className="w-3.5 h-3.5" />} label={`Mileage${totals.miles > 0 ? ` (${totals.miles.toFixed(0)} mi)` : ''}`} value={`$${totals.reimbursement.toFixed(2)}`} />
      </div>

      {heatmap && <MonthHeatmap heatmap={heatmap} />}
    </section>
  )
}

function TimeTile({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.14em] flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold text-white nums">{value}</p>
    </div>
  )
}

function MonthHeatmap({ heatmap }) {
  const { days, leadingBlanks, maxHours, label } = heatmap
  return (
    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-500 uppercase tracking-[0.14em]">Hours per day</p>
      </div>
      <div className="grid grid-cols-7 gap-1 text-[10px]">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-center text-slate-600">{d}</span>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <span key={`blank-${i}`} className="h-8 rounded-md bg-transparent" />
        ))}
        {days.map(d => {
          const intensity = maxHours > 0 ? d.hours / maxHours : 0
          const shade = d.hours === 0
            ? 'bg-slate-900 text-slate-600'
            : intensity > 0.75
              ? 'bg-terracotta text-white'
              : intensity > 0.45
                ? 'bg-terracotta/70 text-white'
                : intensity > 0.2
                  ? 'bg-terracotta/40 text-slate-100'
                  : 'bg-terracotta/20 text-slate-200'
          const [y, m, day] = d.date.split('-')
          return (
            <span
              key={d.date}
              title={`${d.date} · ${d.hours.toFixed(2)}h across ${d.count} shift${d.count === 1 ? '' : 's'}`}
              className={`h-8 rounded-md flex items-center justify-center font-mono ${shade}`}
              data-y={y}
              data-m={m}
            >
              {Number(day)}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function InsightsStrip({ prefs, stateCode }) {
  const paystub = getPaystub()
  const next = nextPayday({
    payFrequency: prefs.payFrequency,
    lastPayDate: prefs.lastPayDate,
    paystub,
  })
  const daysAway = next ? daysUntil(next) : null
  const take = paystub?.gross_pay
    ? estimateTakeHome({
        grossThisCheck: Number(paystub.gross_pay) || 0,
        annualizeOver: prefs.payFrequency || 'biweekly',
        stateCode: stateCode || 'TX',
        filingStatus: prefs.filingStatus || 'single',
        dependents: Number(prefs.dependents) || 0,
      })
    : null
  const activeAnomalies = getAnomalies().filter(a => !a.dismissed).length

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-terracotta" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Next paycheck</p>
        </div>
        <p className="mt-1 text-xl font-semibold text-white nums">
          {next ? formatShortDate(next) : 'Set a pay cycle'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {next
            ? daysAway === 0 ? 'Today'
              : daysAway === 1 ? 'Tomorrow'
              : daysAway && daysAway > 0 ? `in ${daysAway} days`
              : daysAway && daysAway < 0 ? `${Math.abs(daysAway)} days ago`
              : ''
            : 'Add your last pay date in the planner.'}
        </p>
        <Link to="/tools" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-terracotta hover:text-terracotta-light">
          Open planner
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-terracotta" />
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Est. take-home (last stub)</p>
        </div>
        <p className="mt-1 text-xl font-semibold text-white nums">
          {take ? `$${take.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {take ? `from $${Number(paystub?.gross_pay || 0).toFixed(2)} gross · ~${Math.round(take.effectiveRate * 100)}% effective` : 'Upload a stub to project.'}
        </p>
        <Link to="/tools" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-terracotta hover:text-terracotta-light">
          Run scenarios
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className={`rounded-2xl border p-4 ${activeAnomalies > 0 ? 'border-amber-500/30 bg-amber-500/5' : 'border-slate-800 bg-slate-900/60'}`}>
        <div className="flex items-center gap-2">
          <Bell className={`w-4 h-4 ${activeAnomalies > 0 ? 'text-amber-300' : 'text-terracotta'}`} />
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Alerts</p>
        </div>
        <p className="mt-1 text-xl font-semibold text-white nums">
          {activeAnomalies}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {activeAnomalies > 0
            ? 'Something looked off across recent stubs. Open Compare to review.'
            : 'No alerts right now. Continuous wage-check is running.'}
        </p>
        <Link to="/compare" className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-terracotta hover:text-terracotta-light">
          Review alerts
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

/* ---------- Shared Components ---------- */

function StatCard({ icon, label, value, highlight, accent }) {
  return (
    <div className={`rounded-xl p-3 text-center border ${
      highlight
        ? 'bg-red-500/10 border-red-500/20'
        : 'bg-slate-900 border-slate-800'
    }`}>
      <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-xl font-bold ${
        highlight ? 'text-red-400' : accent ? 'text-green-400' : 'text-white'
      }`}>
        {value}
      </div>
    </div>
  )
}


/* ---------- New overview: welcome + month metrics ---------- */

function OverviewSection({ prefs }) {
  const now = new Date()
  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const firstName = (prefs?.firstName || prefs?.name || '').toString().trim().split(' ')[0]

  const paystub = getPaystub()
  const vault = getPaystubVault()
  const allStubs = [paystub, ...vault.map(v => v?.paystub)].filter(Boolean)

  const thisMonthPaid = allStubs.reduce((sum, p) => {
    const d = p?.pay_date || p?.pay_period_end
    if (!d) return sum
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return sum
    if (dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()) {
      return sum + (Number(p.gross_pay) || 0)
    }
    return sum
  }, 0)

  const hoursThisMonth = allStubs.reduce((sum, p) => {
    const d = p?.pay_date || p?.pay_period_end
    if (!d) return sum
    const dt = new Date(d)
    if (isNaN(dt.getTime())) return sum
    if (dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth()) {
      return sum + (Number(p.hours_paid) || 0) + (Number(p.overtime_hours_paid) || 0)
    }
    return sum
  }, 0)

  const employers = new Set(allStubs.map(p => p?.employer_name).filter(Boolean))
  const employerCount = employers.size || 1

  return (
    <div className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
        {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
      </h1>
      <p className="text-slate-400 text-sm mb-5">
        Here&rsquo;s your pay picture for {monthLabel}
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="This month (paid)"
          value={`$${thisMonthPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
        />
        <ProjectedCard
          label="Projected (scheduled)"
          /* TODO: wire to schedule data in next pass */
          value="$0"
        />
        <StatCard
          icon={<ClockIcon className="w-4 h-4" />}
          label="Hours this month"
          value={hoursThisMonth > 0 ? `${hoursThisMonth.toFixed(1)}h` : '0h'}
        />
        <StatCard
          icon={<Briefcase className="w-4 h-4" />}
          label="Employers"
          value={String(employerCount)}
        />
      </div>

      <QuickActions />
    </div>
  )
}

function QuickActions() {
  const items = [
    { to: '/upload', label: 'Upload paystub', icon: Camera, tone: 'terracotta' },
    { to: '/log', label: 'Log shift', icon: Clock, tone: 'default' },
    { to: '/verify', label: 'Verify timesheet', icon: CheckCircle2, tone: 'default' },
    { to: '/compare', label: 'Compare', icon: GitCompareArrows, tone: 'default' },
    { to: '/report', label: 'Report', icon: FileText, tone: 'default' },
  ]
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {items.map(item => {
        const Icon = item.icon
        const terracotta = item.tone === 'terracotta'
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors min-h-[40px] ${
              terracotta
                ? 'bg-terracotta text-slate-950 hover:bg-terracotta/90'
                : 'bg-slate-900 text-slate-200 hover:text-white border border-slate-800 hover:border-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}

function ProjectedCard({ label, value }) {
  return (
    <div className="rounded-xl p-3 text-center border border-amber-500/25 bg-amber-500/5">
      <div className="flex items-center justify-center gap-1.5 text-amber-300/80 mb-1">
        <CalendarClock className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-amber-200">{value}</div>
    </div>
  )
}

function DiscrepancyBanner({ analysis }) {
  const paystub = getPaystub()
  const employer = paystub?.employer_name
  const owed = Number(analysis?.totalOwed) || 0

  // Only surface this banner when the comparison engine actually found something. Avoids
  // showing stale cross-industry placeholder text (like "Target schedule shows 32 hours")
  // after a healthcare demo has been loaded.
  if (owed <= 0 || !employer) return null

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 sm:p-5 flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-100">Possible discrepancy detected</p>
        <p className="text-sm text-amber-100/80 mt-1 leading-relaxed">
          Your last {employer} paystub looks about ${owed.toFixed(0)} short of what your logged hours support.
          Review the line-by-line comparison.
        </p>
      </div>
      <Link
        to="/compare"
        className="self-center inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 text-sm font-semibold min-h-[40px] transition-colors shrink-0"
      >
        Review
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}

function PayPictureGrid() {
  const paystub = getPaystub()
  const vault = getPaystubVault()
  const recentStubs = [paystub, ...vault.map(v => v?.paystub).filter(Boolean)]
    .filter(Boolean)
    .slice(0, 3)

  // Pull upcoming shifts from the user's actual logged data. If nothing is scheduled
  // in the next 14 days, we show the most recent shifts instead so the card is never
  // empty (and never renders employers from a different industry than the current
  // scenario). Employer is taken from the loaded paystub so demo content always
  // matches the selected persona.
  const shifts = getShifts()
  const fallbackEmployer = paystub?.employer_name || 'Work'
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const inTwoWeeks = new Date(today); inTwoWeeks.setDate(inTwoWeeks.getDate() + 14)
  const sorted = [...shifts].sort((a, b) => new Date(a.date) - new Date(b.date))
  let windowed = sorted.filter(s => {
    const d = new Date(`${s.date}T00:00:00`)
    return d >= today && d <= inTwoWeeks
  })
  if (!windowed.length) {
    windowed = sorted.slice(-3)
  }
  const upcomingShifts = windowed.slice(0, 3).map((s, i) => {
    const hoursRaw = (() => {
      const [inH, inM] = (s.clockIn || '0:0').split(':').map(Number)
      const [outH, outM] = (s.clockOut || '0:0').split(':').map(Number)
      let mins = (outH * 60 + outM) - (inH * 60 + inM) - (Number(s.breakMinutes) || 0)
      if (mins < 0) mins += 24 * 60
      return mins / 60
    })()
    const d = new Date(`${s.date}T00:00:00`)
    const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    const fmtTime = (hhmm) => {
      const [h, m] = (hhmm || '').split(':').map(Number)
      if (!Number.isFinite(h)) return ''
      const ap = h >= 12 ? 'PM' : 'AM'
      const hh = ((h + 11) % 12) + 1
      return `${hh}:${String(m || 0).padStart(2, '0')} ${ap}`
    }
    return {
      id: s.id || i,
      employer: s.employer || fallbackEmployer,
      day: dayLabel,
      time: `${fmtTime(s.clockIn)} – ${fmtTime(s.clockOut)}`,
      hours: hoursRaw,
    }
  })

  return (
    <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-terracotta" />
            <h3 className="text-sm font-semibold text-white">Recent paystubs</h3>
          </div>
          <Link to="/vault" className="text-xs font-medium text-terracotta hover:text-terracotta-light">
            View all
          </Link>
        </div>
        {recentStubs.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No paystubs yet. <Link to="/upload" className="text-terracotta hover:text-terracotta-light">Upload one</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {recentStubs.map((p, i) => (
              <li key={`${p?.employer_name || 'stub'}-${i}`}>
                <Link
                  to="/vault"
                  className="flex items-center justify-between py-3 hover:bg-slate-800/40 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {p?.employer_name || 'Paystub'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {p?.pay_period_start && p?.pay_period_end
                        ? `${p.pay_period_start} – ${p.pay_period_end}`
                        : 'Pay period'}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-semibold text-white nums">
                      ${(Number(p?.gross_pay) || 0).toFixed(2)}
                    </p>
                    <p className="text-[11px] text-slate-500">gross</p>
                  </div>
                </Link>
              </li>
            ))}
            {recentStubs.length === 1 && (
              <li className="py-3 text-xs text-slate-500 text-center">and more&hellip;</li>
            )}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-terracotta" />
            <h3 className="text-sm font-semibold text-white">Upcoming shifts</h3>
          </div>
          <Link to="/log" className="text-xs font-medium text-terracotta hover:text-terracotta-light">
            Manage
          </Link>
        </div>
        {upcomingShifts.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">
            No shifts logged yet. <Link to="/log" className="text-terracotta hover:text-terracotta-light">Log one</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {upcomingShifts.map(s => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{s.employer}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{s.day} · {s.time}</p>
                </div>
                <p className="text-sm text-slate-300 nums shrink-0 ml-3">{s.hours.toFixed(1)}h</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function HoursBar({ label, hours, total, color }) {
  const pct = total > 0 ? (hours / total) * 100 : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-medium">{hours.toFixed(1)}h</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
