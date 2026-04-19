import { Link, useNavigate } from 'react-router-dom'
import { Receipt, CalendarClock, Clock, ArrowRight } from 'lucide-react'
import Header from '../components/Header'

const CARDS = [
  {
    key: 'paystub',
    icon: Receipt,
    title: 'Paystub',
    subtitle: 'What you were paid',
    body: "Upload a PDF or photo, or type in the numbers. We'll explain every deduction.",
    to: '/upload',
    // terracotta accent
    accentBorder: 'hover:border-terracotta/60',
    iconWrap: 'bg-terracotta/15 text-terracotta',
    dot: 'bg-terracotta',
  },
  {
    key: 'schedule',
    icon: CalendarClock,
    title: 'Schedule',
    subtitle: "What you'll work",
    body: "Enter your shifts for the week ahead. We'll project what your next paycheck will look like.",
    to: '/log?mode=schedule',
    // amber accent
    accentBorder: 'hover:border-amber-500/60',
    iconWrap: 'bg-amber-500/15 text-amber-400',
    dot: 'bg-amber-400',
  },
  {
    key: 'worked',
    icon: Clock,
    title: 'Hours worked',
    subtitle: 'What you did',
    body: "Quick-log hours you've worked but haven't been paid for yet. Great for tips, cash jobs, or gig work.",
    to: '/log?mode=worked',
    // green accent (stands in for the spec's purple — palette is constrained)
    accentBorder: 'hover:border-green-500/60',
    iconWrap: 'bg-green-500/15 text-green-400',
    dot: 'bg-green-400',
  },
]

export default function EntryPicker() {
  const navigate = useNavigate()

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="mb-8 sm:mb-12">
          <p className="text-[11px] font-medium text-terracotta uppercase tracking-[0.2em]">Step 1 of 2</p>
          <h1 className="mt-3 text-3xl sm:text-5xl font-semibold text-white tracking-[-0.025em] text-balance">
            What are you adding <span className="font-display text-slate-300">today?</span>
          </h1>
          <p className="mt-3 text-slate-400 leading-relaxed max-w-2xl">
            Pick the closest match. You can change this anytime and mix and match throughout the month.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {CARDS.map(card => {
            const Icon = card.icon
            return (
              <button
                type="button"
                key={card.key}
                onClick={() => navigate(card.to)}
                aria-label={`${card.title} — ${card.subtitle}`}
                className={`group text-left rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 sm:p-7 min-h-[280px] flex flex-col transition-all duration-200 hover:-translate-y-0.5 ${card.accentBorder} cursor-pointer focus:outline-none focus:ring-2 focus:ring-terracotta/60`}
              >
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${card.iconWrap}`}>
                  <Icon className="w-5 h-5" />
                </div>

                <div className="mt-5">
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full ${card.dot}`} />
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {card.subtitle}
                    </p>
                  </div>
                  <h2 className="mt-1.5 text-xl sm:text-2xl font-semibold text-white tracking-tight">
                    {card.title}
                  </h2>
                </div>

                <p className="mt-3 text-sm text-slate-400 leading-relaxed">{card.body}</p>

                <div className="mt-auto pt-6 inline-flex items-center gap-1.5 text-sm font-medium text-terracotta group-hover:text-terracotta-light">
                  Continue
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-10 text-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            Already have data? Go to dashboard
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>
    </div>
  )
}
