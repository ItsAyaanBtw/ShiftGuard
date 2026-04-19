import { useEffect, useReducer, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Shield, Check, Sparkles, FileCheck2, DollarSign, ArrowRight } from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import ScrollReveal from '../components/motion/ScrollReveal'
import MagneticButton from '../components/motion/MagneticButton'
import {
  getUserPreferences, saveUserPreferences, FREE_MONTHLY_CHECK_LIMIT,
} from '../lib/storage'
import {
  WAGE_THEFT_ROI, PRO_MONTHLY_USD, PRO_ANNUAL_USD, DEEP_AUDIT_ONE_TIME_USD,
} from '../lib/roiConstants'

/**
 * Pricing page with Deep Audit as the primary upsell.
 *
 * We lead with Deep Audit ($14.99 one-time) because the single highest-value moment for
 * a new user is discovering that a single paycheck error pays for the audit many times
 * over. Pro is still here and still the long-term business, but it now sits underneath
 * the one-time purchase that captures intent on day one.
 */

const PRO_EFFECTIVE_ANNUAL = Number((PRO_ANNUAL_USD / 12).toFixed(2))
const PRO_ANNUAL_DISCOUNT_PCT = Math.round((1 - PRO_ANNUAL_USD / (PRO_MONTHLY_USD * 12)) * 100)
const AUDIT_ROI_MULTIPLE = Math.round(WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD / DEEP_AUDIT_ONE_TIME_USD)

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Unlimited logging, limited checks',
    highlights: [
      `${FREE_MONTHLY_CHECK_LIMIT} paycheck checks per month`,
      'Unlimited shift logging + mileage tracking',
      'Employer time-record uploads',
      'Pay stub vault with CSV export',
      'Take-home estimator + next-paycheck planner',
    ],
    cta: 'Start free',
    to: '/log',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For anyone who wants every paycheck checked',
    highlights: [
      'Unlimited paycheck checks',
      'Paystub Explainer (line by line)',
      'Paycheck Predictor (monthly take-home)',
      'Industry pay packs: healthcare, warehouse, restaurant, trades',
      'Retro pay estimate + HR inquiry email drafts',
      'Continuous wage-check alerts across your vault',
      'Travel-nurse rate X-ray',
    ],
    cta: 'Activate Pro',
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

  function activatePro() {
    saveUserPreferences({ subscriptionTier: 'pro', billingCadence: cadence })
    bump()
    navigate('/tools')
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-14 pb-24">
        <ScrollReveal stagger className="text-center max-w-2xl mx-auto mb-8 sg-stagger">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-3 py-1.5 text-terracotta text-xs sm:text-sm font-medium">
            <Shield className="w-4 h-4" />
            <span>Pricing</span>
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance">
            Start with a{' '}
            <span className="font-display text-terracotta">one-time audit</span>.
          </h1>
          <p className="mt-4 text-slate-400 leading-relaxed max-w-xl mx-auto">
            Most new users catch the error they were looking for in a single check. Run the
            Deep Audit once for ${DEEP_AUDIT_ONE_TIME_USD}. Upgrade to Pro later if you want ongoing verification.
          </p>
          <p className="mt-3 text-[11px] text-slate-500">
            Current plan on this browser:{' '}
            <span className="text-terracotta font-medium capitalize">
              {tier === 'pro' ? 'Pro (demo)' : 'Free'}
            </span>
          </p>
        </ScrollReveal>

        {/* Deep Audit lead card */}
        <ScrollReveal className="max-w-4xl mx-auto mb-10">
          <article className="relative rounded-3xl border-2 border-terracotta/45 bg-gradient-to-br from-slate-900 via-terracotta/10 to-slate-900 p-6 sm:p-10 glass-edge shadow-warm">
            <div className="absolute -top-3 left-6 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-terracotta text-white text-[11px] font-semibold tracking-wide shadow-warm">
              <Sparkles className="w-3 h-3" />
              Start here
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-center">
              <div className="md:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-[11px] font-medium text-slate-200">
                  <FileCheck2 className="w-3.5 h-3.5 text-terracotta" />
                  Deep Audit
                </div>
                <h2 className="mt-3 text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                  A 6-month look-back in one report
                </h2>
                <p className="mt-2 text-slate-400 leading-relaxed text-sm">
                  Upload up to six months of pay stubs at once. The full rule engine runs across every
                  period, surfaces patterns like a differential paid at the wrong rate for months, and
                  produces a branded PDF with citations you can hand to payroll or keep for your records.
                </p>
                <ul className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
                  {['Cross-period reconciliation', 'Pattern detection', 'Rule citations', 'Branded PDF'].map(x => (
                    <li key={x} className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-950 px-3 py-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                      {x}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
                  The average affected worker loses about ${WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD.toLocaleString()} a year to pay errors (EPI).
                  That means one catch covers the audit {AUDIT_ROI_MULTIPLE}x over.
                </p>
              </div>
              <div className="md:col-span-5">
                <div className="rounded-2xl border border-slate-700/80 bg-slate-950/70 p-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-semibold text-white nums tracking-tight">${DEEP_AUDIT_ONE_TIME_USD}</span>
                    <span className="text-sm text-slate-400">one-time</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    No subscription. Works for Free or Pro users.
                  </p>
                  <span
                    className="mt-4 block w-full text-center py-3 rounded-xl text-sm font-semibold bg-terracotta/40 text-terracotta cursor-not-allowed"
                    aria-disabled="true"
                  >
                    Coming soon
                  </span>
                  <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                    Billing isn&rsquo;t wired in this build. Pay once for a 6-month look-back report.
                  </p>
                </div>
              </div>
            </div>
          </article>
        </ScrollReveal>

        {/* Secondary: subscription choice */}
        <ScrollReveal className="max-w-4xl mx-auto mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-[0.18em]">Or keep checking every month</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Free or Pro for ongoing verification</h3>
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-800 bg-slate-900 p-1">
              <CadencePill active={cadence === 'monthly'} onClick={() => setCadence('monthly')} label="Monthly" />
              <CadencePill
                active={cadence === 'annual'}
                onClick={() => setCadence('annual')}
                label={<>Annual <span className="ml-1 text-[10px] font-bold text-terracotta">save {PRO_ANNUAL_DISCOUNT_PCT}%</span></>}
              />
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal stagger className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-4xl mx-auto sg-stagger items-stretch">
          {TIERS.map(t => (
            <TierCard
              key={t.id}
              tier={t}
              cadence={cadence}
              currentTier={tier}
              onActivate={activatePro}
            />
          ))}
        </ScrollReveal>

        {/* Trial band */}
        <ScrollReveal className="max-w-4xl mx-auto mt-10">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-4">
            <div className="inline-flex items-center gap-2 text-white shrink-0">
              <DollarSign className="w-5 h-5 text-terracotta" />
              <p className="text-sm font-semibold">The honest math</p>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed flex-1">
              Deep Audit pays for itself on a single catch ({AUDIT_ROI_MULTIPLE}x ROI at the EPI average).
              Pro makes sense once you&rsquo;ve had a first catch and want every future paycheck checked.
              Free keeps working if you&rsquo;re not ready.
            </p>
            <Link
              to="/tools"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-terracotta hover:text-terracotta-light shrink-0"
            >
              Open toolkit
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </ScrollReveal>

        <p className="text-xs text-slate-600 text-center mt-10 max-w-xl mx-auto leading-relaxed">
          Pricing is not wired to a billing provider in this build. Activating Pro sets a local flag so you can
          test the gated tools and comparison flows. Deep Audit remains marked coming soon.
        </p>

        <OrgPlanCard />

        <div className="mt-12 max-w-xl mx-auto">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

/**
 * OrgPlanCard — the B2B pitch for labor unions and worker centers. Sits underneath
 * the individual tiers because the sales motion is different: seat-based, org-wide,
 * with a contact step rather than self-serve checkout. Copy deliberately stays
 * inside the union / worker-center space and doesn't talk to individual workers here.
 */
function OrgPlanCard() {
  const mailBody = encodeURIComponent(
    'Hi, I work with [org name] and would like to learn about the ShiftGuard org plan.\n\nRough member count:\nTop employers we cover:\nWhat we want to prove out first:\n',
  )
  return (
    <ScrollReveal className="mt-14 max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-terracotta/10 via-slate-900 to-slate-900 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[10px] font-semibold text-terracotta uppercase tracking-[0.18em]">
              For labor unions and worker centers
            </p>
            <h3 className="mt-2 text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              Give every member a pay-check audit.
            </h3>
            <p className="mt-3 text-slate-400 leading-relaxed">
              One dashboard for your organizers, one account per member. Paystubs and
              timesheets stay on each member&rsquo;s device unless they share them with
              your staff. Run CBA rules alongside federal and state rules, so a missed
              travel-time line or a 7th-day premium shows up as a flagged case instead of
              a complaint that arrives six months late.
            </p>
          </div>
          <a
            href={`mailto:orgs@shiftguard.app?subject=ShiftGuard%20org%20plan&body=${mailBody}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-terracotta hover:bg-terracotta-dark text-slate-950 text-sm font-semibold min-h-[40px] transition-colors shrink-0"
          >
            Request a walkthrough
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <OrgFeature title="Seat-based pricing" body="Flat monthly rate per member seat. Unlimited organizer seats for your staff." />
          <OrgFeature title="Contract-aware rules" body="Upload your CBA and ShiftGuard will check the stub against contract premiums, not just federal and state." />
          <OrgFeature title="Exports for legal" body="CSV of flagged paystubs with citations. Handoff to a rep counsel is one download." />
        </div>

        <p className="mt-5 text-[11px] text-slate-500 leading-relaxed">
          Not sold to employers. We only work with worker-side organizations. Pilot pricing available for locals under 5,000 members and for worker centers.
        </p>
      </div>
    </ScrollReveal>
  )
}

function OrgFeature({ title, body }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 text-xs text-slate-400 leading-relaxed">{body}</p>
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
    <article className="relative rounded-3xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 p-6 sm:p-7 flex flex-col transition-colors">
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
            onClick={onActivate}
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
