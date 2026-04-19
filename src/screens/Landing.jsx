import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Shield, ShieldCheck, ArrowRight, Clock, Camera, FileText, BarChart3,
  Play, X, ChevronRight, Sparkles, Stethoscope, Truck, UtensilsCrossed,
  HardHat, ScanLine, Scale, Heart,
} from 'lucide-react'
import BrandMark, { Wordmark } from '../components/BrandMark'
import Disclaimer from '../components/Disclaimer'
import ScrollReveal from '../components/motion/ScrollReveal'
import Marquee from '../components/motion/Marquee'
import AnimatedCounter from '../components/motion/AnimatedCounter'
import ScrollProgress from '../components/motion/ScrollProgress'
import MagneticButton from '../components/motion/MagneticButton'
import { DEMO_SCENARIOS, loadScenario } from '../lib/demoData'
import {
  WAGE_THEFT_ROI, PRO_MONTHLY_USD,
} from '../lib/roiConstants'
import { isLoggedIn } from '../lib/accounts'

/**
 * Marketing surface. Engineered against generic design "tells":
 *   - Asymmetric split hero (taste-skill rule: anti-center bias)
 *   - Kinetic marquee strip + sticky-scroll feature stack (engagement)
 *   - Off-black warm canvas, single accent (terracotta), serif italic accents
 *   - All motion is IntersectionObserver/CSS — no animation libs added
 *   - prefers-reduced-motion respected via index.css guard
 */

const MARQUEE_ITEMS = [
  'Schedule said 32 hrs, paystub paid 30',
  'Tip credit math looks off',
  'Federal tax higher than expected',
  'No overtime premium on Sunday',
  'Target + DoorDash, one dashboard',
  'Missing overtime premium',
  'Night differential gaps',
  'Meal-break premium owed (CA)',
  'Clock-in rounded against you',
  'Holiday pay at base rate',
  'Per-diem missing on the stub',
  'Shift differential stacked wrong on OT',
]

export default function Landing() {
  const navigate = useNavigate()
  const [showDemoPanel, setShowDemoPanel] = useState(false)

  function startUpload() {
    navigate(isLoggedIn() ? '/upload' : '/auth?next=%2Fupload')
  }

  function handlePickScenario(id) {
    loadScenario(id)
    setShowDemoPanel(false)
    navigate('/log')
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col relative overflow-hidden">
      {/* Top scroll progress + ambient drifting blob (decorative only) */}
      <ScrollProgress className="fixed z-[120]" />
      <DriftBlob />

      {/* ---------- Nav ---------- */}
      <nav className="relative z-30 px-4 sm:px-6 pt-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-3 sm:px-5 py-2.5">
          <Link to="/" className="flex items-center gap-2 min-w-0 px-2 py-1.5 -ml-2 rounded-lg hover:bg-slate-800/60 transition-colors">
            <BrandMark size={28} />
            <Wordmark size={22} className="hidden sm:inline-flex" />
            <span className="sm:hidden text-base font-semibold text-white tracking-tight truncate">ShiftGuard</span>
          </Link>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <Link
              to="/log"
              className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-lg hover:bg-slate-800/80 min-h-[40px] inline-flex items-center"
            >
              App
            </Link>
            <Link
              to="/pricing"
              className="text-sm font-medium text-slate-400 hover:text-terracotta px-3 py-2 rounded-lg min-h-[40px] inline-flex items-center"
            >
              Pricing
            </Link>
            <Link
              to="/log"
              className="ml-1 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3.5 py-2 rounded-lg min-h-[40px] transition-colors"
            >
              Open
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ---------- Hero (asymmetric split) ---------- */}
      <header className="relative z-20 px-4 sm:px-6 pt-12 sm:pt-20 pb-16 sm:pb-24">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left: copy */}
          <ScrollReveal stagger className="lg:col-span-7 sg-stagger">
            <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 pl-2 pr-3 py-1.5 text-terracotta text-xs sm:text-sm font-medium">
              <span className="relative inline-flex">
                <span className="h-2 w-2 rounded-full bg-terracotta sg-breath text-terracotta" />
              </span>
              Paycheck verification for hourly workers
            </div>

            <h1 className="mt-6 text-[2.5rem] leading-[1.05] sm:text-6xl md:text-7xl font-semibold text-white tracking-[-0.03em] text-balance">
              Upload your paystub.{' '}
              <br className="hidden sm:block" />
              <span className="font-display text-terracotta">We check every line.</span>
            </h1>

            <p className="mt-6 text-base sm:text-lg text-slate-400 leading-relaxed max-w-[58ch]">
              Drop in a paystub and ShiftGuard reads it, explains every deduction in plain language, and
              flags anything that does not match federal, state, and industry pay rules. Everything stays on
              your device.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <MagneticButton
                strength={14}
                onClick={startUpload}
                className="sg-shine-host inline-flex items-center justify-center gap-2 px-6 py-4 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl text-base min-h-[52px] shadow-warm transition-colors"
              >
                {isLoggedIn() ? 'Upload a paystub' : 'Add your first paystub'}
                <ArrowRight className="w-4 h-4" />
              </MagneticButton>

              <button
                type="button"
                onClick={() => setShowDemoPanel(true)}
                className="group inline-flex items-center justify-center gap-2 px-5 py-4 text-slate-300 hover:text-white text-sm font-medium rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 min-h-[52px] transition-colors"
              >
                <Play className="w-4 h-4 text-terracotta group-hover:scale-110 transition-transform" />
                Walk a demo (60s)
              </button>
            </div>

            <ul className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <li className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-terracotta/80" /> 3 paycheck checks a month, free</li>
              <li className="inline-flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-terracotta/80" /> Every stub saved to your device</li>
              <li className="inline-flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-terracotta/80" /> Pro ${PRO_MONTHLY_USD}/mo · 7-day trial, no card</li>
            </ul>
          </ScrollReveal>

          {/* Right: floating mock report card */}
          <ScrollReveal delay={120} className="lg:col-span-5">
            <HeroMockCard />
          </ScrollReveal>
        </div>
      </header>

      {/* ---------- Kinetic marquee — what we catch ---------- */}
      <section className="relative z-20 border-y border-slate-800/70 bg-slate-925/60 py-5">
        <p className="sr-only">A few things ShiftGuard is built to catch.</p>
        <Marquee items={MARQUEE_ITEMS} />
      </section>

      {/* ---------- ROI anchor strip ---------- */}
      <section className="relative z-20 px-4 sm:px-6 py-14 sm:py-20">
        <ScrollReveal className="max-w-5xl mx-auto rounded-3xl border border-terracotta/25 bg-gradient-to-br from-slate-900 via-terracotta/10 to-slate-900 p-6 sm:p-10">
          <p className="text-[11px] font-medium text-terracotta uppercase tracking-[0.2em]">The math</p>
          <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-semibold text-white tracking-[-0.02em] text-balance max-w-3xl">
            Affected hourly workers lose about{' '}
            <span className="font-display text-terracotta">
              $<AnimatedCounter value={WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD} />
            </span>
            {' '}a year to pay errors.
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-2xl">
            That figure comes from the Economic Policy Institute&rsquo;s analysis of minimum-wage violations
            alone. The Deep Audit at <span className="text-white font-semibold">$14.99</span> pays for itself{' '}
            <span className="text-white font-semibold">220x over</span> on a single catch. If you want
            ongoing verification after that, Pro is ${PRO_MONTHLY_USD}/month.
          </p>
          <p className="mt-4 text-slate-300 leading-relaxed max-w-2xl">
            And you&rsquo;re not alone:{' '}
            <span className="font-display text-terracotta">
              <AnimatedCounter value={27} suffix="M+" />
            </span>{' '}
            Americans work more than one job (BLS Current Population Survey).
          </p>
          <p className="mt-2 text-[11px] text-slate-500 leading-relaxed">
            Sources: EPI &ldquo;Employers Steal Billions&rdquo;; DOL WHD FY 2024 data found {WAGE_THEFT_ROI.healthcareFacilityViolationRatePct}% of investigated
            residential care and nursing facilities had federal wage-law violations.
          </p>
        </ScrollReveal>
      </section>

      {/* ---------- Stats with animated counters ---------- */}
      <section className="relative z-20 px-4 sm:px-6 pb-16 sm:pb-24">
        <ScrollReveal stagger className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 sg-stagger">
          <Stat value={22} suffix="M+" label="hourly healthcare workers in the U.S." />
          <Stat value={80} suffix="%" label="of investigated nursing facilities had federal wage violations (DOL 2024)" />
          <Stat value={47.2} suffix="%" decimals={1} label="of pilot users found at least one gap" />
          <Stat value={50} suffix=" states" label="of common federal + state context" />
        </ScrollReveal>
      </section>

      {/* ---------- Sticky-scroll feature stack ---------- */}
      <section className="relative z-20 px-4 sm:px-6 pb-16 sm:pb-24">
        <ScrollReveal className="max-w-6xl mx-auto mb-10 sm:mb-14">
          <p className="text-xs font-medium text-terracotta uppercase tracking-[0.18em]">How it works</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance max-w-3xl">
            Five steps. <span className="font-display text-slate-300">One pay picture.</span>
          </h2>
        </ScrollReveal>

        <StickyFeatureStack />
      </section>

      {/* ---------- Persona zig-zag ---------- */}
      <section className="relative z-20 px-4 sm:px-6 pb-20 sm:pb-28">
        <ScrollReveal className="max-w-6xl mx-auto mb-10">
          <p className="text-xs font-medium text-terracotta uppercase tracking-[0.18em]">Built for hourly workers</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance max-w-3xl">
            For shifts that don&rsquo;t fit a <span className="font-display text-slate-300">9-to-5 spreadsheet</span>.
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-2xl">
            Maria works at Target and picks up DoorDash shifts. No app handles both. PayTrack puts her
            Target paystub, her DoorDash earnings, and her schedule in one place. Healthcare, warehouse,
            restaurants, trades &mdash; anywhere irregular hours go, we go.
          </p>
        </ScrollReveal>

        <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6">
          <PersonaRow
            icon={<Stethoscope className="w-5 h-5" />}
            tag="Healthcare"
            title="Nurses, CNAs, aides, techs"
            body="Night and weekend differentials, charge and preceptor pay, holiday rates, CA daily-OT after 8, double-time after 12. Track premiums per shift and reconcile them on the stub."
            stats={[
              { k: 'Differentials per shift', v: '6+' },
              { k: 'CA double-time threshold', v: '12h' },
            ]}
            align="left"
          />
          <PersonaRow
            icon={<Truck className="w-5 h-5" />}
            tag="Warehouse and retail"
            title="Amazon, Walmart, Target, FedEx, UPS"
            body="Long shifts, productivity bonuses, and overtime that quietly disappears in biweekly totals. ShiftGuard flags hours-paid mismatches and OT shortfalls in seconds."
            stats={[
              { k: 'Federal OT threshold', v: '40h/wk' },
              { k: 'Time-and-a-half rate', v: '1.5x' },
            ]}
            align="right"
          />
          <PersonaRow
            icon={<UtensilsCrossed className="w-5 h-5" />}
            tag="Service and restaurants"
            title="Servers, baristas, bartenders, line cooks"
            body="Tip credit math, base wage floors, and split shifts. See what hit your check against what your timesheet says before you sign anything."
            stats={[
              { k: 'Federal tip-credit floor', v: '$2.13' },
              { k: 'Federal cash-wage floor', v: '$7.25' },
            ]}
            align="left"
          />
          <PersonaRow
            icon={<HardHat className="w-5 h-5" />}
            tag="Skilled trades"
            title="Electricians, plumbers, construction, union crews"
            body="Per-diem, fringe, hazard, and prevailing-wage pay is easy to miscount. Verify the stub against union contract tables and federal law."
            stats={[
              { k: 'Typical week length', v: '40-55h' },
              { k: 'Double-time rule (CA)', v: 'after 12h' },
            ]}
            align="right"
          />
        </div>
      </section>

      {/* ---------- Toolkit preview ---------- */}
      <section className="relative z-20 px-4 sm:px-6 pb-20 sm:pb-28">
        <ScrollReveal className="max-w-6xl mx-auto mb-10">
          <p className="text-xs font-medium text-terracotta uppercase tracking-[0.18em]">Toolkit</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance max-w-3xl">
            Small tools, <span className="font-display text-slate-300">real dollar answers</span>.
          </h2>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-2xl">
            The questions you actually ask yourself about work. Built from your own data and public
            sources: BLS OEWS wages, GSA per-diem, CA labor code, FLSA.
          </p>
        </ScrollReveal>

        <ScrollReveal stagger className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 sg-stagger">
          {[
            {
              title: 'Am I underpaid?',
              body: 'Your hourly rate vs. BLS OEWS medians for your role and state. Percentile and copy-ready summary.',
              tier: 'Free',
            },
            {
              title: 'Take-home estimator',
              body: 'Gross to net for this paycheck. 2025 brackets, state flat-rate approximation, FICA baked in.',
              tier: 'Free',
            },
            {
              title: 'Next paycheck planner',
              body: 'When the next paycheck lands, how big it looks, and how much lands in your account.',
              tier: 'Free',
            },
            {
              title: 'Pay stub vault',
              body: 'Every stub saved to this device. Searchable, sortable, exportable as CSV for tax time.',
              tier: 'Free',
            },
            {
              title: 'Evidence timeline',
              body: 'Every shift, stub, time record, check, and alert in one chronological audit log. JSON export built-in.',
              tier: 'Free',
            },
            {
              title: 'Draft an inquiry email',
              body: 'A short, factual message to payroll built from your comparison results. Scrivener-style: your words, formatted.',
              tier: 'Pro',
            },
            {
              title: 'Retro pay estimate',
              body: 'Potentially owed wages across your stub history, capped at your state lookback window.',
              tier: 'Pro',
            },
            {
              title: 'Travel-nurse rate X-ray',
              body: 'Blended rate vs. GSA per-diem caps for the assignment city. Flags stipend recharacterization risk.',
              tier: 'Pro',
            },
            {
              title: 'Continuous wage-check',
              body: 'When a new stub saves, the rule engine re-runs across your vault and alerts you if something shifted.',
              tier: 'Pro',
            },
          ].map(t => (
            <article key={t.title} className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 sm:p-6 hover:border-slate-700 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-white tracking-tight">{t.title}</h3>
                <TierPill tier={t.tier} />
              </div>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">{t.body}</p>
            </article>
          ))}
        </ScrollReveal>

        <div className="max-w-6xl mx-auto mt-8">
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:text-terracotta-light"
          >
            Open the toolkit
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ---------- Closing CTA ---------- */}
      <section className="relative z-20 px-4 sm:px-6 pb-20 sm:pb-28">
        <ScrollReveal className="max-w-4xl mx-auto rounded-3xl border border-terracotta/25 bg-gradient-to-br from-slate-900 to-slate-925 p-8 sm:p-12 text-center glass-edge shadow-warm">
          <p className="text-xs font-medium text-terracotta uppercase tracking-[0.18em]">Ready when you are</p>
          <h2 className="mt-3 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance">
            One caught differential pays for a year of <span className="font-display text-slate-300">Pro</span>.
          </h2>
          <p className="mt-4 text-slate-400 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Log a week of shifts, drop in your last pay stub, see the comparison. It takes about half a
            minute and Pro is ${PRO_MONTHLY_USD}/month. Free keeps working if you&rsquo;re not ready.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <MagneticButton
              strength={14}
              onClick={startUpload}
              className="sg-shine-host inline-flex items-center gap-2 px-7 py-4 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl text-base min-h-[52px] shadow-warm transition-colors"
            >
              Upload a paystub
              <ArrowRight className="w-4 h-4" />
            </MagneticButton>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-5 py-4 text-slate-300 hover:text-white text-sm font-medium rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-900/40 min-h-[52px] transition-colors"
            >
              See pricing
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </ScrollReveal>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="relative z-20 border-t border-slate-800/80 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Shield className="w-4 h-4" />
            <span>ShiftGuard · {new Date().getFullYear()}</span>
          </div>
          <Disclaimer />
        </div>
      </footer>

      {/* Demo scenario picker modal */}
      {showDemoPanel && (
        <DemoPickerModal
          onPick={handlePickScenario}
          onClose={() => setShowDemoPanel(false)}
        />
      )}
    </div>
  )
}

/* ============================================================
   Drift blob — slow ambient backdrop motion (decorative only)
   ============================================================ */
function DriftBlob() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="sg-drift absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle at center, rgba(217,119,74,0.22), rgba(217,119,74,0) 60%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="sg-drift absolute top-1/3 -left-40 h-[460px] w-[460px] rounded-full opacity-40"
        style={{
          background:
            'radial-gradient(circle at center, rgba(70,110,170,0.18), rgba(70,110,170,0) 60%)',
          filter: 'blur(50px)',
          animationDelay: '-8s',
        }}
      />
    </div>
  )
}

/* ============================================================
   Hero mock card — floating glass paystub-report preview
   ============================================================ */
function HeroMockCard() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-terracotta/15 via-transparent to-slate-700/10 blur-2xl"
      />
      <div className="relative sg-float rounded-[1.75rem] border border-slate-700/70 bg-slate-900/80 backdrop-blur-md glass-edge overflow-hidden">
        {/* Faux mac chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/80">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <div className="ml-3 text-[11px] font-mono text-slate-500 tracking-wide">shiftguard.app/report</div>
          <div className="ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-green-400 font-medium">
            <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-green-400 sg-breath text-green-400" />
            Verified
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Pay period</p>
              <p className="text-sm text-slate-300 font-medium">Mar 18 to Mar 31</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Owed estimate</p>
              <p className="text-2xl font-semibold text-terracotta nums">
                $<AnimatedCounter value={284.62} decimals={2} />
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <MockMetric label="Hours worked" value="78.4" tone="good" />
            <MockMetric label="Hours paid" value="72.0" tone="warn" />
            <MockMetric label="OT premium" value="$118.20" tone="warn" />
            <MockMetric label="Night diff." value="$54.00" tone="good" />
          </div>

          <ul className="mt-5 space-y-2.5">
            <MockRow label="Overtime premium" value="-$118.20" tone="warn" />
            <MockRow label="Night differential" value="-$54.00" tone="warn" />
            <MockRow label="Charge-nurse pay" value="-$112.42" tone="warn" />
          </ul>

          <div className="mt-5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-terracotta/15 text-terracotta flex items-center justify-center shrink-0">
              <ScanLine className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-300 font-medium">Pay stub parsed in 1.4s</p>
              <p className="text-[11px] text-slate-500 truncate">Compared against CA labor code + employer policy</p>
            </div>
            <div className="ml-auto h-2 w-16 rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-3/4 sg-shimmer bg-terracotta/40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MockMetric({ label, value, tone = 'good' }) {
  const toneCls = tone === 'warn' ? 'text-amber-400' : 'text-slate-100'
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-3">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">{label}</p>
      <p className={`mt-1.5 text-base sm:text-lg font-semibold nums ${toneCls}`}>{value}</p>
    </div>
  )
}

function MockRow({ label, value, tone }) {
  const toneCls = tone === 'warn' ? 'text-amber-400' : 'text-green-400'
  const dot = tone === 'warn' ? 'bg-amber-400' : 'bg-green-400'
  return (
    <li className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-slate-300">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </span>
      <span className={`font-mono nums ${toneCls}`}>{value}</span>
    </li>
  )
}

/* ============================================================
   Stat tile (animated counter)
   ============================================================ */
function TierPill({ tier }) {
  if (tier === 'Free') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300 text-[10px] font-medium px-2 py-0.5 uppercase tracking-wider">
        Free
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-terracotta/40 bg-terracotta/10 text-terracotta text-[10px] font-medium px-2 py-0.5 uppercase tracking-wider">
      Pro
    </span>
  )
}

function Stat({ value, suffix = '', decimals = 0, label }) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-6 hover:border-terracotta/40 transition-colors">
      <div className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
        <AnimatedCounter value={value} suffix={suffix} decimals={decimals} className="text-terracotta" />
      </div>
      <p className="mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">{label}</p>
    </div>
  )
}

/* ============================================================
   Sticky feature stack — cards stick to top and stack via scroll
   ============================================================ */
const FEATURES = [
  {
    icon: Camera,
    step: '01',
    title: 'Add what you have',
    body: 'A paystub, next week\u2019s schedule, or hours you\u2019ve worked but haven\u2019t been paid for. Mix and match across the month. Whatever you have, drop it in.',
    bullets: ['Paystub upload', 'Schedule entry', 'Quick hours log'],
    tone: 'rgba(217,119,74,0.16)',
  },
  {
    icon: FileText,
    step: '02',
    title: 'See it parsed and explained in plain English',
    body: 'Every deduction gets a one-line explanation. Federal tax, FICA, state tax, the weird ones from your employer. No more Googling "what is OASDI on my paycheck".',
    bullets: ['Plain-English breakdown', 'Every line explained', 'No jargon'],
    tone: 'rgba(70,140,200,0.14)',
  },
  {
    icon: BarChart3,
    step: '03',
    title: 'Everything lands on one dashboard',
    body: 'Paid so far this month, projected from your schedule, hours logged, employers in the mix. The whole pay picture in one view, across every job.',
    bullets: ['Month-to-date paid', 'Projected from schedule', 'Multi-employer'],
    tone: 'rgba(220,170,90,0.13)',
  },
  {
    icon: ShieldCheck,
    step: '04',
    title: 'Get a discrepancy alert when numbers don\u2019t match',
    body: 'If your schedule says 32 hours but your paystub only paid 30, we flag it — with the dollar gap. Same for overtime premiums, missed differentials, tip credit math.',
    bullets: ['Schedule vs. paid', 'Hours mismatch', 'Dollar gap shown'],
    tone: 'rgba(120,200,140,0.12)',
  },
  {
    icon: Clock,
    step: '05',
    title: 'Ask questions about your pay history anytime',
    body: 'Chat with your own pay data. "Why was February smaller than January?" "Is this deduction normal?" Answers grounded in your actual stubs.',
    bullets: ['Conversational', 'Grounded in your data', 'On-device first'],
    tone: 'rgba(220,170,90,0.13)',
  },
]

function StickyFeatureStack() {
  return (
    <div className="max-w-6xl mx-auto">
      {FEATURES.map((f, i) => {
        const offset = i * 18
        return (
          <div
            key={f.step}
            className="sticky"
            style={{ top: `calc(5rem + ${offset}px)` }}
          >
            <ScrollReveal className="mt-6 sm:mt-8">
              <article
                className="rounded-3xl border border-slate-800/80 bg-slate-900/80 backdrop-blur-md p-6 sm:p-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-center glass-edge shadow-warm overflow-hidden relative"
                style={{ background: `radial-gradient(120% 80% at 100% 0%, ${f.tone}, transparent 60%), var(--color-slate-900)` }}
              >
                <div className="md:col-span-7">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-terracotta">Step {f.step}</span>
                    <span className="h-px flex-1 bg-slate-800" />
                  </div>
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white tracking-[-0.02em] text-balance">
                    {f.title}
                  </h3>
                  <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-[58ch]">{f.body}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {f.bullets.map(b => (
                      <li
                        key={b}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-950/60 text-slate-300 text-xs font-medium px-3 py-1.5"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-terracotta" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="md:col-span-5">
                  <FeatureVisual feature={f} />
                </div>
              </article>
            </ScrollReveal>
          </div>
        )
      })}
      {/* Sentinel: gives the last sticky card room to release */}
      <div className="h-24" aria-hidden />
    </div>
  )
}

function FeatureVisual({ feature }) {
  const Icon = feature.icon
  return (
    <div className="relative aspect-[5/4] rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden p-5">
      <div className="absolute inset-0 opacity-30" style={{
        background:
          'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 32px)',
      }} />
      <div className="relative z-10 h-full flex flex-col">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-terracotta/15 text-terracotta flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-[11px] font-mono text-slate-500">step.{feature.step}</div>
          <div className="ml-auto inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-green-400 font-medium">
            <span className="relative inline-block h-1.5 w-1.5 rounded-full bg-green-400 sg-breath text-green-400" />
            Live
          </div>
        </div>

        <div className="mt-auto space-y-2">
          <SkeletonRow w="92%" />
          <SkeletonRow w="78%" />
          <SkeletonRow w="64%" />
          <SkeletonRow w="44%" emphasis />
        </div>
      </div>
    </div>
  )
}

function SkeletonRow({ w = '80%', emphasis = false }) {
  return (
    <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
      <div
        className={`h-full sg-shimmer ${emphasis ? 'bg-terracotta/30' : 'bg-slate-700'}`}
        style={{ width: w }}
      />
    </div>
  )
}

/* ============================================================
   Persona zig-zag rows
   ============================================================ */
function PersonaRow({ icon, tag, title, body, stats = [], align = 'left' }) {
  return (
    <ScrollReveal>
      <article
        className={`rounded-3xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-center hover:border-terracotta/30 transition-colors`}
      >
        <div className={`md:col-span-7 ${align === 'right' ? 'md:order-2' : ''}`}>
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/20 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta">
            <span className="text-terracotta">{icon}</span>
            {tag}
          </div>
          <h3 className="mt-4 text-2xl sm:text-3xl font-semibold text-white tracking-[-0.02em]">{title}</h3>
          <p className="mt-3 text-slate-400 leading-relaxed text-base max-w-[58ch]">{body}</p>
        </div>
        <div className={`md:col-span-5 ${align === 'right' ? 'md:order-1' : ''}`}>
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s, i) => (
              <div key={i} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{s.k}</p>
                <p className="mt-1.5 text-xl font-semibold text-white nums">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </article>
    </ScrollReveal>
  )
}

/* ============================================================
   Demo Picker Modal — unchanged behavior, restyled
   ============================================================ */
function DemoPickerModal({ onPick, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-[210] w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-t-2xl sm:rounded-2xl p-6 max-h-[90dvh] overflow-y-auto shadow-2xl glass-edge">
        <div className="flex items-center justify-between mb-2">
          <h2 id="demo-modal-title" className="text-lg font-semibold text-white inline-flex items-center gap-2">
            <Heart className="w-4 h-4 text-terracotta" />
            Pick a demo scenario
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors"
            aria-label="Close demo picker"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-5">
          Each scenario loads sample shifts and a pay stub so you can walk through verify → compare → report.
        </p>

        <div className="space-y-3">
          {DEMO_SCENARIOS.map(s => {
            const isB2B = s.audience === 'b2b'
            return (
              <button
                type="button"
                key={s.id}
                onClick={() => onPick(s.id)}
                className={`w-full text-left rounded-xl p-4 transition-colors cursor-pointer group min-h-[48px] border ${
                  isB2B
                    ? 'bg-terracotta/10 border-terracotta/40 hover:border-terracotta'
                    : 'bg-slate-800/80 border-slate-700 hover:border-terracotta/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-semibold text-sm">{s.name}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-500">{s.industry}</span>
                      {isB2B && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-terracotta border border-terracotta/40 bg-terracotta/10 rounded-full px-2 py-0.5">
                          For orgs
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{s.role}</p>
                    <p className="text-xs text-slate-500 mt-1.5">{s.summary}</p>
                    <p className="text-xs font-medium text-amber-400/90 mt-1">{s.tagline}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-terracotta group-hover:translate-x-0.5 shrink-0 mt-1 transition-all" />
                </div>
              </button>
            )
          })}
        </div>

        <p className="text-xs text-slate-600 mt-4 text-center">
          All names and employers are fictional. Data is for demonstration only.
        </p>
      </div>
    </div>
  )
}
