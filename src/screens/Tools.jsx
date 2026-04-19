import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Wrench, TrendingUp, Gauge, Plane, Coins, Mail, Scale, ArrowRight,
  Lock, DollarSign, Sparkles, ShieldCheck, Calculator, CalendarClock,
  FileText, LineChart,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import ScrollReveal from '../components/motion/ScrollReveal'
import {
  getShifts, getPaystub, getUserState, getUserPreferences, saveUserPreferences,
} from '../lib/storage'
import { WAGE_THEFT_ROI, PRO_MONTHLY_USD, PRO_ANNUAL_USD } from '../lib/roiConstants'

import MarketRateTool from '../components/tools/MarketRateTool'
import PtoValueTool from '../components/tools/PtoValueTool'
import VolatilityTool from '../components/tools/VolatilityTool'
import TravelBlendTool from '../components/tools/TravelBlendTool'
import RetroPayTool from '../components/tools/RetroPayTool'
import HrEmailTool from '../components/tools/HrEmailTool'
import TaxEstimatorTool from '../components/tools/TaxEstimatorTool'
import NextPaycheckTool from '../components/tools/NextPaycheckTool'
import PaystubExplainerTool from '../components/tools/PaystubExplainerTool'
import PaycheckPredictorTool from '../components/tools/PaycheckPredictorTool'

/**
 * Tools hub. Paneled layout: left gives a grid of tiles, right renders the selected tool.
 * On small screens the right pane collapses below.
 *
 * Gating is soft for the hackathon: Pro and Premium tiles are clickable but open a paywall
 * pane instead of the tool until `subscriptionTier` is set accordingly.
 */

const TOOLS = [
  {
    id: 'market',
    name: 'Am I underpaid?',
    tier: 'free',
    icon: TrendingUp,
    blurb: 'Your rate vs. BLS OEWS median for your role and state.',
    component: MarketRateTool,
  },
  {
    id: 'takehome',
    name: 'Take-home estimator',
    tier: 'free',
    icon: Calculator,
    blurb: 'Gross to net for this paycheck with 2025 brackets.',
    component: TaxEstimatorTool,
  },
  {
    id: 'nextpay',
    name: 'Next paycheck planner',
    tier: 'free',
    icon: CalendarClock,
    blurb: 'When your next paycheck lands and how big it looks.',
    component: NextPaycheckTool,
  },
  {
    id: 'explainer',
    name: 'Paystub explainer',
    tier: 'pro',
    icon: FileText,
    blurb: 'Every line of your last paystub in plain language.',
    component: PaystubExplainerTool,
  },
  {
    id: 'predictor',
    name: 'Paycheck predictor',
    tier: 'pro',
    icon: LineChart,
    blurb: 'Project the next 1-4 paychecks from logged shifts + your pay cycle.',
    component: PaycheckPredictorTool,
  },
  {
    id: 'pto',
    name: 'PTO value calculator',
    tier: 'pro',
    icon: Coins,
    blurb: 'What your accrued PTO is actually worth in dollars.',
    component: PtoValueTool,
  },
  {
    id: 'volatility',
    name: 'Paycheck volatility score',
    tier: 'pro',
    icon: Gauge,
    blurb: 'How steady your weekly hours are. Shareable number.',
    component: VolatilityTool,
  },
  {
    id: 'hremail',
    name: 'Draft an inquiry email',
    tier: 'pro',
    icon: Mail,
    blurb: 'A short, factual message to payroll from your comparison results.',
    component: HrEmailTool,
  },
  {
    id: 'travel',
    name: 'Travel nurse rate X-ray',
    tier: 'pro',
    icon: Plane,
    blurb: 'Blended rate vs. GSA caps; flags stipend recharacterization risk.',
    component: TravelBlendTool,
  },
  {
    id: 'retro',
    name: 'Retro pay estimate',
    tier: 'pro',
    icon: Scale,
    blurb: 'Potentially owed wages across your history, within state lookback.',
    component: RetroPayTool,
  },
]

export default function Tools() {
  const [activeId, setActiveId] = useState('market')
  const navigate = useNavigate()
  const tier = getUserPreferences().subscriptionTier || 'free'

  const active = useMemo(() => TOOLS.find(t => t.id === activeId) || TOOLS[0], [activeId])
  const ActiveComponent = active.component

  const locked = !canAccess(active.tier, tier)

  const ctx = {
    shifts: getShifts(),
    paystub: getPaystub(),
    stateCode: getUserState(),
    preferences: getUserPreferences(),
  }

  function activateForDemo(target) {
    saveUserPreferences({ subscriptionTier: target })
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <ScrollReveal stagger className="mb-8 sg-stagger">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta">
            <Wrench className="w-3.5 h-3.5" />
            Toolkit
          </div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance max-w-3xl">
            Small tools, <span className="font-display text-slate-300">real dollar answers</span>.
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-2xl">
            The kind of questions you actually ask yourself about work: am I underpaid, what is my PTO
            worth, is my travel package defensible. Anchored on public data and your own numbers.
          </p>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed max-w-2xl">
            Workers affected by pay errors lose about ${WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD.toLocaleString()} a year
            on average (EPI). Pro at ${PRO_MONTHLY_USD}/month or ${PRO_ANNUAL_USD}/year pays for itself on the first catch.
          </p>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-4 xl:col-span-4">
            <nav aria-label="Tools" className="space-y-2">
              {TOOLS.map(t => (
                <ToolTile
                  key={t.id}
                  tool={t}
                  active={t.id === activeId}
                  tier={tier}
                  onClick={() => setActiveId(t.id)}
                />
              ))}
            </nav>

            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Your plan</p>
              <p className="text-white font-medium text-sm mt-1">
                {tier === 'pro' ? 'Pro (demo)' : 'Free'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tier !== 'pro' ? (
                  <button
                    type="button"
                    onClick={() => activateForDemo('pro')}
                    className="text-[11px] font-medium text-terracotta hover:text-terracotta-light px-2.5 py-1 rounded-md border border-terracotta/40 hover:border-terracotta"
                  >
                    Activate Pro (demo)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => activateForDemo('free')}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-300 px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700"
                  >
                    Reset to Free
                  </button>
                )}
                <Link
                  to="/pricing"
                  className="text-[11px] font-medium text-slate-400 hover:text-white px-2.5 py-1 rounded-md border border-slate-800 hover:border-slate-700 inline-flex items-center gap-1"
                >
                  See plans
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </aside>

          <section className="lg:col-span-8 xl:col-span-8">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 sm:p-7 min-h-[360px] glass-edge">
              {locked ? (
                <Paywall
                  onActivate={() => activateForDemo('pro')}
                  onDemoAlternative={() => navigate('/pricing')}
                />
              ) : (
                <ActiveComponent ctx={ctx} />
              )}
            </div>
            <div className="mt-6">
              <Disclaimer />
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

function ToolTile({ tool, active, tier, onClick }) {
  const Icon = tool.icon
  const blocked = !canAccess(tool.tier, tier)
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 transition-colors flex items-start gap-3 ${
        active
          ? 'border-terracotta/50 bg-terracotta/10'
          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
      }`}
    >
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
        active ? 'bg-terracotta/20 text-terracotta' : 'bg-slate-900 text-slate-300 border border-slate-800'
      }`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white truncate">{tool.name}</span>
          <TierPill tier={tool.tier} blocked={blocked} />
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tool.blurb}</p>
      </div>
    </button>
  )
}

function TierPill({ tier, blocked }) {
  if (tier === 'free') return null
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border border-terracotta/40 text-terracotta bg-terracotta/10">
      {blocked ? <Lock className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
      Pro
    </span>
  )
}

function Paywall({ onActivate, onDemoAlternative }) {
  return (
    <div className="text-center max-w-md mx-auto py-6">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-800 text-slate-300 mb-4 border border-slate-700">
        <ShieldCheck className="w-5 h-5" />
      </div>
      <h3 className="text-xl font-semibold text-white tracking-tight">This tool is part of Pro</h3>
      <p className="mt-3 text-sm text-slate-400 leading-relaxed">
        Pro opens unlimited paycheck checks, industry pay packs, the inquiry email composer,
        PTO + volatility tools, the travel-nurse rate X-ray, retro pay estimates, and pattern detection.
        ${PRO_MONTHLY_USD}/month or ${PRO_ANNUAL_USD}/year.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        <DollarSign className="inline w-3 h-3 mr-0.5 -mt-0.5" />
        Paycheck errors cost affected workers about ${WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD.toLocaleString()} a year on average.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onActivate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white text-sm font-semibold"
        >
          Activate Pro (demo)
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDemoAlternative}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 text-sm"
        >
          See pricing
        </button>
      </div>
    </div>
  )
}

function canAccess(toolTier, userTier) {
  if (toolTier === 'free') return true
  return userTier === 'pro' || userTier === 'premium'
}
