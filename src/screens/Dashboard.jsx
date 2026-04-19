import { useEffect, useReducer } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, AlertTriangle, Users, MapPin,
  ShieldAlert, ArrowRight, BarChart3, Info, CheckCircle2, History,
  CalendarClock, Bell,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import {
  getViolations,
  getUserState,
  getVerifiedPaycheckCount,
  getUserPreferences,
  getVerificationHistory,
  getCumulativeFlaggedUnique,
  getPersonalMonthlyFlaggedTrend,
  getPaystub,
  getAnomalies,
} from '../lib/storage'
import { normalizeAnalysis } from '../lib/analysisUtils'
import { nextPayday, daysUntil, formatShortDate } from '../lib/payCycle'
import { estimateTakeHome } from '../lib/taxEstimator'
import stateLaws from '../data/stateLaws'

const CHART_COLORS = ['#c4784a', '#d4956e', '#e8b898', '#a85e34', '#8a4828']
const SEVERITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#eab308' }

const MOCK_COMMUNITY = {
  totalDetected: 127_450,
  usersActive: 3_842,
  avgPerWorker: 2_634,
  monthlyTrend: [
    { month: 'Nov', amount: 68_200 },
    { month: 'Dec', amount: 74_800 },
    { month: 'Jan', amount: 89_300 },
    { month: 'Feb', amount: 95_600 },
    { month: 'Mar', amount: 112_100 },
    { month: 'Apr', amount: 127_450 },
  ],
  byIndustry: [
    { name: 'Restaurants', value: 38_200, pct: 30 },
    { name: 'Retail', value: 25_490, pct: 20 },
    { name: 'Construction', value: 22_941, pct: 18 },
    { name: 'Hospitality', value: 17_843, pct: 14 },
    { name: 'Healthcare', value: 12_745, pct: 10 },
    { name: 'Other', value: 10_231, pct: 8 },
  ],
  byViolationType: [
    { name: 'Overtime premium', count: 1_842 },
    { name: 'Hours mismatch', count: 1_256 },
    { name: 'Minimum wage check', count: 487 },
    { name: 'Break timing', count: 892 },
    { name: 'Gross pay gap', count: 634 },
  ],
  byRegion: [
    { name: 'Austin', amount: 42_300, workers: 1_240 },
    { name: 'Houston', amount: 31_200, workers: 890 },
    { name: 'Dallas', amount: 24_500, workers: 720 },
    { name: 'San Antonio', amount: 18_900, workers: 540 },
    { name: 'Other TX', amount: 10_550, workers: 452 },
  ],
}

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
  const verificationHistory = getVerificationHistory()
  const cumulativeUnique = getCumulativeFlaggedUnique()
  const personalTrend = getPersonalMonthlyFlaggedTrend()
  const uniquePeriods = new Set(verificationHistory.map(h => h.paystubKey)).size

  const hasAnalysis = !!(analysis?.summary)
  const hasDiscrepancies = hasAnalysis && analysis.discrepancies.length > 0

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Your paycheck dashboard</h1>
          <p className="text-slate-400 text-sm">
            Stay on top of every paycheck. Personal stats from your last verification; community figures are illustrative
            demo data.
          </p>
        </div>

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

        {verificationHistory.length > 0 && (
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <History className="w-5 h-5 text-terracotta" />
              <h2 className="text-lg font-semibold text-white">Your verification history</h2>
              <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">This device</span>
              <Link
                to="/history"
                className="ml-auto text-xs font-medium text-terracotta hover:text-terracotta-light inline-flex items-center gap-1"
              >
                Open full timeline
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Each time you open Compare we store a snapshot here (local only). Cumulative uses the latest run per pay
              period so re-checking the same stub does not double-count.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <StatCard
                icon={<BarChart3 className="w-4 h-4" />}
                label="Pay periods"
                value={String(uniquePeriods)}
              />
              <StatCard
                icon={<DollarSign className="w-4 h-4" />}
                label="Cumulative flagged"
                value={`$${cumulativeUnique.toFixed(2)}`}
                highlight
              />
              <StatCard
                icon={<History className="w-4 h-4" />}
                label="Runs on file"
                value={String(verificationHistory.length)}
              />
            </div>

            {personalTrend.length > 0 && (
              <ChartCard title="Your flagged estimates by month" icon={<TrendingUp className="w-4 h-4" />}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={personalTrend}>
                    <defs>
                      <linearGradient id="personalArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c4784a" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#c4784a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="month"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8a8a9a', fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#8a8a9a', fontSize: 11 }}
                      tickFormatter={v => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8 }}
                      formatter={v => [`$${Number(v).toFixed(2)}`, 'Flagged (sum of runs)']}
                    />
                    <Area
                      type="monotone"
                      dataKey="amount"
                      stroke="#c4784a"
                      strokeWidth={2}
                      fill="url(#personalArea)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            <div className="mt-4 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3 border-b border-slate-800">
                Recent runs
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-left text-slate-500 text-xs uppercase">
                      <th className="px-4 py-2">When</th>
                      <th className="px-4 py-2">Employer</th>
                      <th className="px-4 py-2">Period</th>
                      <th className="px-4 py-2 text-right">Flagged</th>
                      <th className="px-4 py-2 text-right">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verificationHistory.slice(0, 12).map((row, idx) => (
                      <tr key={`${row.at}-${row.paystubKey}-${idx}`} className="border-b border-slate-800/60 last:border-0">
                        <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">
                          {new Date(row.at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 max-w-[140px] truncate">{row.employer || '-'}</td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">
                          {row.periodStart && row.periodEnd ? `${row.periodStart} to ${row.periodEnd}` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-amber-400 font-medium">
                          ${Number(row.totalDifference).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400">{row.discrepancyCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Community section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-terracotta" />
            <h2 className="text-lg font-semibold text-white">Community Impact</h2>
            <span className="text-xs text-slate-600 bg-slate-800 px-2 py-0.5 rounded-full">Demo data</span>
          </div>

          {/* Community stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={<DollarSign className="w-4 h-4" />}
              label="Total detected"
              value={`$${(MOCK_COMMUNITY.totalDetected).toLocaleString()}`}
            />
            <StatCard
              icon={<Users className="w-4 h-4" />}
              label="Active workers"
              value={MOCK_COMMUNITY.usersActive.toLocaleString()}
            />
            <StatCard
              icon={<AlertTriangle className="w-4 h-4" />}
              label="Avg per worker"
              value={`$${MOCK_COMMUNITY.avgPerWorker.toLocaleString()}`}
            />
            <StatCard
              icon={<TrendingUp className="w-4 h-4" />}
              label="Month-over-month"
              value="+14%"
              accent
            />
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Monthly trend */}
          <ChartCard title="Discrepancies flagged over time (demo)" icon={<TrendingUp className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={MOCK_COMMUNITY.monthlyTrend}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c4784a" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#c4784a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8a8a9a', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8a8a9a', fontSize: 12 }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8 }}
                  labelStyle={{ color: '#d0d0da' }}
                  formatter={v => [`$${v.toLocaleString()}`, 'Detected']}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#c4784a"
                  strokeWidth={2}
                  fill="url(#areaGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Industry breakdown */}
          <ChartCard title="By industry" icon={<BarChart3 className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={MOCK_COMMUNITY.byIndustry}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  dataKey="value"
                  paddingAngle={3}
                  stroke="none"
                >
                  {MOCK_COMMUNITY.byIndustry.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8 }}
                  formatter={(v, name) => [`$${v.toLocaleString()}`, name]}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  formatter={(value) => <span style={{ color: '#b0b0be', fontSize: 12 }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Violation types */}
          <ChartCard title="Top discrepancy types (demo)" icon={<AlertTriangle className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MOCK_COMMUNITY.byViolationType} layout="vertical" barSize={16}>
                <XAxis
                  type="number"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8a8a9a', fontSize: 12 }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#b0b0be', fontSize: 12 }}
                  width={110}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8 }}
                  formatter={v => [v.toLocaleString(), 'Cases']}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#c4784a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Regional breakdown */}
          <ChartCard title="By region (Texas)" icon={<MapPin className="w-4 h-4" />}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MOCK_COMMUNITY.byRegion} barSize={24}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8a8a9a', fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#8a8a9a', fontSize: 12 }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{ background: '#1a1a24', border: '1px solid #2a2a38', borderRadius: 8 }}
                  formatter={(v, name) => {
                    if (name === 'amount') return [`$${v.toLocaleString()}`, 'Detected']
                    return [v, name]
                  }}
                />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} fill="#c4784a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Context callout */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-3">Why paycheck verification matters</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-terracotta">22M+</div>
              <div className="text-xs text-slate-500 mt-1">U.S. healthcare workers with complex pay</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-terracotta">Many</div>
              <div className="text-xs text-slate-500 mt-1">payroll issues are fixed after a clear paper trail</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-terracotta">Free tier</div>
              <div className="text-xs text-slate-500 mt-1">keeps core logging available to hourly workers</div>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 mb-4">
          <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            Community data shown here is simulated for demonstration purposes.
            In production, this dashboard would display anonymized, aggregated data from all ShiftGuard users
            without ever exposing individual worker information.
          </p>
        </div>

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

function ChartCard({ title, icon, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-terracotta">{icon}</span>
        <p className="text-sm font-medium text-white">{title}</p>
      </div>
      {children}
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
