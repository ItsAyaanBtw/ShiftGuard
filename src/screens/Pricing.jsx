import { useEffect, useReducer, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Check, Sparkles, FileCheck2, DollarSign } from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import ScrollReveal from '../components/motion/ScrollReveal'
import MagneticButton from '../components/motion/MagneticButton'
import {
  getUserPreferences, saveUserPreferences, FREE_MONTHLY_CHECK_LIMIT,
} from '../lib/storage'
import {
  WAGE_THEFT_ROI, PRO_MONTHLY_USD, PRO_ANNUAL_USD, DEEP_AUDIT_ONE_TIME_USD,
  proMonthlyRoiMultiple, proAnnualRoiMultiple,
} from '../lib/roiConstants'

/**
 * Two-tier paid pricing. We simplified back from a three-tier ladder (Free / Pro / Premium)
 * because survey feedback said accessibility matters more than feature segmentation at this
 * stage. Premium features folded into Pro, which stays at a price the broader hourly
 * workforce can absorb.
 */

const PRO_EFFECTIVE_ANNUAL = Number((PRO_ANNUAL_USD / 12).toFixed(2))   // 4.92
const PRO_ANNUAL_DISCOUNT_PCT = Math.round((1 - PRO_ANNUAL_USD / (PRO_MONTHLY_USD * 12)) * 100)  // 30%

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Unlimited logging, limited checks',
    highlights: [
      `${FREE_MONTHLY_CHECK_LIMIT} paycheck checks per month`,
      'Unlimited shift logging',
      'Unlimited employer time-record uploads',
      'Pay stub vault with CSV export',
      'Federal FLSA rule coverage',
      'Take-home estimator + next-paycheck planner',
      'Market rate vs. BLS median (basic)',
    ],
    cta: 'Start free',
    to: '/log',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Everything you need to back every paycheck',
    highlights: [
      'Unlimited paycheck checks',
      'Industry pay packs: healthcare, warehouse, restaurant, trades',
      'Full CA / NY / TX / FL rule engine with CA meal-break math',
      'Travel-nurse rate X-ray with GSA per-diem comparison',
      'Retro pay estimate across state lookback windows',
      'Inquiry email drafts to payroll (unlimited)',
      'Continuous wage-check alerts across your vault',
      'PTO value and paycheck volatility tools',
      'Historical audit trail and evidence export',
    ],
    cta: 'Activate Pro',
    featured: true,
  },
]

export default function Pricing() {
  const navigate = useNavigate()
  const [, bump] = useReducer(n => n + 1, 0)
  const [cadence, setCadence] = useState('annual')

  useEffect(() => {
    const fn = () => bump()
    window.addEventListener('shiftguard-data-changed', fn)
    return () => window.removeEventListener('shiftguard-data-changed', fn)
  }, [])

  const tier = getUserPreferences().subscriptionTier || 'free'

  function activate(target) {
    saveUserPreferences({ subscriptionTier: target, billingCadence: cadence })
    bump()
    navigate('/tools')
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 pb-24">
        <ScrollReveal stagger className="text-center max-w-2xl mx-auto mb-10 sg-stagger">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-3 py-1.5 text-terracotta text-xs sm:text-sm font-medium">
            <Shield className="w-4 h-4" />
            <span>Pricing</span>
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance">
            Priced for the workers it&rsquo;s <span className="font-display text-terracotta">built for</span>.
          </h1>
          <p className="mt-4 text-slate-400 leading-relaxed max-w-xl mx-auto">
            Free keeps the basics free for anyone paid hourly. Pro opens unlimited checks, the full
            rule engine, travel-nurse tooling, and retro pay estimates at ${PRO_MONTHLY_USD}/month. No billing is wired
            in this build, so plan toggles are local demo flags.
          </p>

          <div className="mt-6 inline-flex items-center rounded-full border border-slate-800 bg-slate-900 p-1">
            <CadencePill active={cadence === 'monthly'} onClick={() => setCadence('monthly')} label="Monthly" />
            <CadencePill
              active={cadence === 'annual'}
              onClick={() => setCadence('annual')}
              label={<>Annual <span className="ml-1 text-[10px] font-bold text-terracotta">save {PRO_ANNUAL_DISCOUNT_PCT}%</span></>}
            />
          </div>

          <p className="mt-3 text-[11px] text-slate-500">
            Current plan on this browser:{' '}
            <span className="text-terracotta font-medium capitalize">
              {tier === 'pro' ? 'Pro (demo)' : 'Free'}
            </span>
          </p>
        </ScrollReveal>

        {/* ROI anchor */}
        <ScrollReveal className="max-w-4xl mx-auto mb-10">
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-terracotta/10 to-slate-900 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="inline-flex items-center gap-2 text-terracotta shrink-0">
              <DollarSign className="w-5 h-5" />
              <p className="text-sm font-semibold">The math</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Affected workers lose about <span className="text-white font-semibold nums">$
              {WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD.toLocaleString()}</span> a year to pay errors (EPI).
              Pro at ${PRO_MONTHLY_USD}/month pays for itself
              <span className="text-white font-semibold"> {proMonthlyRoiMultiple()}x over</span> on one catch.
              Annual Pro at ${PRO_ANNUAL_USD}/year pays for itself {proAnnualRoiMultiple()}x over.
            </p>
          </div>
        </ScrollReveal>

        {/* 2-tier grid */}
        <ScrollReveal stagger className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto sg-stagger items-stretch">
          {TIERS.map(t => (
            <TierCard
              key={t.id}
              tier={t}
              cadence={cadence}
              currentTier={tier}
              onActivate={activate}
            />
          ))}
        </ScrollReveal>

        {/* Trial band */}
        <ScrollReveal className="max-w-4xl mx-auto mt-12">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="inline-flex items-center gap-2 text-white shrink-0">
              <Sparkles className="w-5 h-5 text-terracotta" />
              <p className="text-sm font-semibold">7-day Pro trial, no card required</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed flex-1">
              Log at least one shift to start the trial. Annual signups get a 14-day trial. Cancel any
              time from Settings; nothing auto-renews during the trial. Deep Audit is a separate
              one-time purchase available to Free and Pro users alike.
            </p>
          </div>
        </ScrollReveal>

        {/* Deep Audit row */}
        <ScrollReveal className="max-w-4xl mx-auto mt-8">
          <article className="rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-center">
            <div className="md:col-span-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                <FileCheck2 className="w-3.5 h-3.5 text-terracotta" />
                Deep Audit
              </div>
              <h3 className="mt-3 text-2xl font-semibold text-white tracking-tight">
                A 12-month look-back in one report
              </h3>
              <p className="mt-2 text-slate-400 leading-relaxed text-sm">
                Upload up to a year of pay stubs at once. The full rule engine runs across every period, we
                surface patterns like a differential paid at the wrong rate for months, and you get a
                branded PDF with citations you can hand to payroll or keep for your records.
              </p>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                {['Cross-period reconciliation', 'Pattern detection', 'Rule citations', 'Branded PDF'].map(x => (
                  <li key={x} className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                    {x}
                  </li>
                ))}
              </ul>
            </div>
            <div className="md:col-span-5">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold text-white nums">${DEEP_AUDIT_ONE_TIME_USD}</span>
                  <span className="text-xs text-slate-500">one-time purchase</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Available to Free and Pro users. Not bundled with any subscription.
                </p>
                <span
                  className="mt-4 block w-full text-center py-3 rounded-xl text-sm font-semibold bg-slate-800 text-slate-400 cursor-not-allowed"
                  aria-disabled="true"
                >
                  Coming soon
                </span>
                <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                  Billing isn&rsquo;t wired in this build. Pay once for a 12-month look-back report.
                </p>
              </div>
            </div>
          </article>
        </ScrollReveal>

        <p className="text-xs text-slate-600 text-center mt-10 max-w-xl mx-auto leading-relaxed">
          Pricing is not wired to a billing provider here. Activating Pro sets a local flag so you can
          test the gated tools and comparison flows. Deep Audit remains marked coming soon.
        </p>

        <div className="mt-12 max-w-xl mx-auto">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

function TierCard({ tier, cadence, currentTier, onActivate }) {
  const isPro = tier.id === 'pro'
  const isAnnual = cadence === 'annual'
  const priceTop = tier.id === 'free'
    ? '$0'
    : isAnnual ? `$${PRO_EFFECTIVE_ANNUAL.toFixed(2)}` : `$${PRO_MONTHLY_USD.toFixed(2)}`
  const cadenceLabel = tier.id === 'free' ? '' : '/month'
  const subPrice = isPro && isAnnual ? `billed $${PRO_ANNUAL_USD} annually` : null
  const isCurrent = currentTier === tier.id

  return (
    <article
      className={`relative rounded-3xl border p-6 sm:p-7 flex flex-col transition-colors ${
        tier.featured
          ? 'border-terracotta/40 bg-terracotta/5 shadow-warm md:-translate-y-2 glass-edge'
          : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
      }`}
    >
      {tier.featured && (
        <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-terracotta text-white text-[11px] font-semibold tracking-wide shadow-warm">
          <Sparkles className="w-3 h-3" />
          Most popular
        </div>
      )}

      <div className="flex items-center gap-2">
        {isPro ? <Sparkles className="w-4 h-4 text-terracotta" /> : <Shield className="w-4 h-4 text-slate-300" />}
        <h2 className="text-base font-semibold text-white">{tier.name}</h2>
      </div>
      <p className="text-xs text-slate-400 mt-1">{tier.tagline}</p>

      <div className="mt-3 flex items-baseline gap-1 min-h-[44px]">
        <span className="text-4xl font-semibold text-white tracking-tight nums">{priceTop}</span>
        {cadenceLabel && <span className="text-slate-500 text-sm">{cadenceLabel}</span>}
      </div>
      {subPrice && <p className="text-[11px] text-slate-500">{subPrice}</p>}
      {tier.id === 'free' && <p className="text-[11px] text-slate-500">Free forever</p>}

      <ul className="mt-5 space-y-2.5 flex-1">
        {tier.highlights.map(line => (
          <li key={line} className="flex items-start gap-2 text-sm text-slate-300">
            <Check className="w-4 h-4 text-terracotta shrink-0 mt-0.5" />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      <div className="mt-7">
        {tier.id === 'free' ? (
          <Link
            to={tier.to}
            className="block text-center py-3 rounded-xl text-sm font-semibold border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {isCurrent ? 'You are on Free' : tier.cta}
          </Link>
        ) : (
          <MagneticButton
            type="button"
            onClick={() => onActivate(tier.id)}
            strength={10}
            className="sg-shine-host block w-full text-center py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer bg-terracotta hover:bg-terracotta-dark text-white"
          >
            {isCurrent ? `You are on ${tier.name}` : `${tier.cta} (demo)`}
          </MagneticButton>
        )}
      </div>
    </article>
  )
}

function CadencePill({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
        active ? 'bg-terracotta text-white' : 'text-slate-300 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}
