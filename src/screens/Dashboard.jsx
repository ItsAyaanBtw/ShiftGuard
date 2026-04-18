import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  TrendingUp, DollarSign, AlertTriangle, Users, MapPin,
  ShieldAlert, ArrowRight, BarChart3, Info
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { getViolations, getShifts, getUserState } from '../lib/storage'
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
    { name: 'Unpaid overtime', count: 1_842 },
    { name: 'Missing hours', count: 1_256 },
    { name: 'Minimum wage', count: 487 },
    { name: 'Meal break', count: 892 },
    { name: 'Pay discrepancy', count: 634 },
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
  const violationData = useMemo(() => getViolations(), [])
  const shifts = useMemo(() => getShifts(), [])
  const stateCode = useMemo(() => getUserState(), [])
  const state = stateLaws[stateCode]

  const hasPersonalData = violationData?.violations?.length > 0

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Impact Dashboard</h1>
          <p className="text-slate-400 text-sm">
            Your data and the bigger picture. Every dollar detected is a dollar that should be in a worker's pocket.
          </p>
        </div>

        {/* Personal stats */}
        {hasPersonalData ? (
          <PersonalSection
            violationData={violationData}
            shifts={shifts}
            stateName={state?.name}
            onAction={() => navigate('/action')}
          />
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 mb-8 text-center">
            <ShieldAlert className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">No personal analysis yet</p>
            <p className="text-slate-500 text-sm mb-4">
              Log shifts and upload a pay stub to see your personal impact stats here.
            </p>
            <button
              onClick={() => navigate('/log')}
              className="px-5 py-2 rounded-lg bg-terracotta hover:bg-terracotta-dark text-white text-sm font-medium transition-colors cursor-pointer"
            >
              Get started
            </button>
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
          <ChartCard title="Wage theft detected over time" icon={<TrendingUp className="w-4 h-4" />}>
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
          <ChartCard title="Top violation types" icon={<AlertTriangle className="w-4 h-4" />}>
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
          <h3 className="text-white font-semibold mb-3">The bigger picture</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-terracotta">$50B</div>
              <div className="text-xs text-slate-500 mt-1">stolen from U.S. workers annually</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-terracotta">7.4M</div>
              <div className="text-xs text-slate-500 mt-1">Texas workers affected</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-terracotta">2%</div>
              <div className="text-xs text-slate-500 mt-1">of victims ever file a complaint</div>
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

function PersonalSection({ violationData, shifts, stateName, onAction }) {
  const { violations, totalOwed, summary } = violationData
  const highCount = violations.filter(v => v.severity === 'high').length
  const medCount = violations.filter(v => v.severity === 'medium').length
  const lowCount = violations.filter(v => v.severity === 'low').length

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
          label="Wages owed"
          value={`$${totalOwed.toFixed(2)}`}
          highlight
        />
        <StatCard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Violations"
          value={violations.length}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Hours worked"
          value={`${summary.totalHoursWorked.toFixed(1)}h`}
        />
        <StatCard
          icon={<DollarSign className="w-4 h-4" />}
          label="Expected gross"
          value={`$${summary.expectedGross.toFixed(2)}`}
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
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Violation severity</p>
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
        onClick={onAction}
        className="w-full flex items-center justify-center gap-2 py-3 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
      >
        Take action on ${totalOwed.toFixed(2)}
        <ArrowRight className="w-5 h-5" />
      </button>
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
