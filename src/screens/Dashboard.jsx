import { useEffect, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, AlertTriangle,
  ShieldAlert, ArrowRight, CheckCircle2,
  CalendarClock, Bell, Receipt, Briefcase, Clock as ClockIcon,
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
} from '../lib/storage'
import { normalizeAnalysis } from '../lib/analysisUtils'
import { nextPayday, daysUntil, formatShortDate } from '../lib/payCycle'
import { estimateTakeHome } from '../lib/taxEstimator'
import stateLaws from '../data/stateLaws'

const SHOW_DEMO_DISCREPANCY = true
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

        {SHOW_DEMO_DISCREPANCY && <DiscrepancyBanner />}

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

function DiscrepancyBanner() {
  return (
    <div className="mb-6 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 sm:p-5 flex items-start gap-3">
      <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
        <AlertTriangle className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-100">Possible discrepancy detected</p>
        <p className="text-sm text-amber-100/80 mt-1 leading-relaxed">
          Your Target schedule shows 32 hours but your last paystub paid for 30 hours. You may be owed about $36.
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

  // TODO: wire to real schedule data model
  const upcomingShifts = [
    { id: 1, employer: 'Target', day: 'Mon, Apr 21', time: '10:00 AM – 4:00 PM', hours: 6 },
    { id: 2, employer: 'Target', day: 'Wed, Apr 23', time: '2:00 PM – 10:00 PM', hours: 8 },
    { id: 3, employer: 'DoorDash', day: 'Sat, Apr 26', time: 'Evening block', hours: 5 },
  ]

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
                  to={`/paystub/${i}`}
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
        <ul className="divide-y divide-slate-800">
          {upcomingShifts.map(s => (
            <li key={s.id} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{s.employer}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.day} · {s.time}</p>
              </div>
              <p className="text-sm text-slate-300 nums shrink-0 ml-3">{s.hours}h</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-600">
          Demo data &mdash; schedule integration is in progress.
        </p>
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
