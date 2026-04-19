import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Wrench, TrendingUp, MessagesSquare, Timer, Sparkles, ArrowRight,
  DollarSign, ShieldCheck, Lock,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import ScrollReveal from '../components/motion/ScrollReveal'
import {
  getShifts, getPaystub, getUserState, getUserPreferences, saveUserPreferences,
} from '../lib/storage'
import { WAGE_THEFT_ROI, PRO_MONTHLY_USD, PRO_ANNUAL_USD } from '../lib/roiConstants'

import MarketRateTool from '../components/tools/MarketRateTool'
import AskPaychecksTool from '../components/tools/AskPaychecksTool'
import OvertimeMultiplierTool from '../components/tools/OvertimeMultiplierTool'
import WhatIfTool from '../components/tools/WhatIfTool'

/**
 * Tools hub. Trimmed to the four tools the product actually leads on:
 *   - Am I underpaid (free)
 *   - Ask your paychecks (Pro, RAG over the on-device vault)
 *   - Overtime multiplier (free, state-aware)
 *   - What If (Pro, consolidates the calculators that used to live in their own tiles)
 */
const TOOLS = [
  {
    id: 'market',
    name: 'Am I underpaid?',
    tier: 'free',
    icon: TrendingUp,
    blurb: 'Your hourly rate vs. the BLS median for your role and state.',
    component: MarketRateTool,
  },
  {
    id: 'overtime',
    name: 'Overtime multiplier',
    tier: 'free',
    icon: Timer,
    blurb: 'Your state\u2019s real OT rule. Type a week, see what should land in 1.5x and 2x.',
    component: OvertimeMultiplierTool,
  },
  {
    id: 'ask',
    name: 'Ask your paychecks',
    tier: 'pro',
    icon: MessagesSquare,
    blurb: 'One question, one short assistant call answered from your saved paystubs only.',
    component: AskPaychecksTool,
  },
  {
    id: 'whatif',
    name: 'What if',
    tier: 'pro',
    icon: Sparkles,
    blurb: 'Take-home, next paycheck, monthly projection, and PTO value in one tabbed view.',
    component: WhatIfTool,
  },
]

export default function Tools() {
  const [activeId, setActiveId] = useState('market')
  const navigate = useNavigate()
  const tier = getUserPreferences().subscriptionTier || 'free'
  const active = TOOLS.find(t => t.id === activeId) || TOOLS[0]
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
            Four tools, <span className="font-display text-slate-300">no clutter</span>.
          </h1>
          <p className="mt-3 text-slate-400 text-base leading-relaxed max-w-2xl">
            Free anchors on the two questions every hourly worker asks: am I underpaid, and is my
            overtime right. Pro adds a search across your saved paystubs and a single hub for the
            scenario calculators.
          </p>
          <p className="mt-3 text-xs text-slate-500 leading-relaxed max-w-2xl">
            Workers affected by pay errors lose about ${WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD.toLocaleString()} a year (EPI).
            Pro at ${PRO_MONTHLY_USD}/month or ${PRO_ANNUAL_USD}/year pays for itself on the first catch.
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
          {tool.tier !== 'free' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border border-terracotta/40 text-terracotta bg-terracotta/10">
              {blocked ? <Lock className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
              Pro
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tool.blurb}</p>
      </div>
    </button>
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
        Pro opens unlimited paycheck checks, the paycheck history search, and the What If calculator.
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
