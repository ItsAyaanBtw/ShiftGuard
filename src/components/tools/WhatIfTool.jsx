import { useState } from 'react'
import { Sparkles, Calculator, CalendarClock, Coins, LineChart } from 'lucide-react'
import { ToolHeader } from './MarketRateTool'
import TaxEstimatorTool from './TaxEstimatorTool'
import NextPaycheckTool from './NextPaycheckTool'
import PtoValueTool from './PtoValueTool'
import PaycheckPredictorTool from './PaycheckPredictorTool'

/**
 * What If is a single hub for the scenario calculators that previously cluttered the
 * tools list. Tabs render in-place; each tab forwards `ctx` to the underlying tool so
 * none of the per-calculator logic had to move.
 */
const TABS = [
  { id: 'takehome', label: 'Take-home', icon: Calculator, component: TaxEstimatorTool },
  { id: 'nextpay', label: 'Next paycheck', icon: CalendarClock, component: NextPaycheckTool },
  { id: 'projection', label: 'Month projection', icon: LineChart, component: PaycheckPredictorTool },
  { id: 'pto', label: 'PTO value', icon: Coins, component: PtoValueTool },
]

export default function WhatIfTool({ ctx }) {
  const [active, setActive] = useState('takehome')
  const Tab = TABS.find(t => t.id === active)?.component || TABS[0].component

  return (
    <div>
      <ToolHeader
        icon={<Sparkles className="w-4 h-4" />}
        title="What if"
        subtitle="One place for the four calculators most workers ask about: take-home, next paycheck, monthly projection, and PTO value."
      />

      <div role="tablist" className="mt-5 inline-flex flex-wrap items-center gap-1 rounded-full border border-slate-800 bg-slate-950 p-1">
        {TABS.map(t => {
          const Icon = t.icon
          const on = t.id === active
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                on ? 'bg-terracotta text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="mt-5">
        <Tab ctx={ctx} />
      </div>
    </div>
  )
}
