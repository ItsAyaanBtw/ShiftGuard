import { Gauge, Share2 } from 'lucide-react'
import { computeVolatility } from '../../lib/volatility'
import { ToolHeader, EmptyHint } from './MarketRateTool'

export default function VolatilityTool({ ctx }) {
  const result = computeVolatility(ctx?.shifts || [])

  if (!result) {
    return (
      <div>
        <ToolHeader
          icon={<Gauge className="w-4 h-4" />}
          title="Paycheck volatility score"
          subtitle="How steady your weekly hours are. Needs at least 2 weeks of shift data."
        />
        <div className="mt-5">
          <EmptyHint text="Log at least 3 shifts across 2 different weeks to see your volatility score." />
        </div>
      </div>
    )
  }

  const pctPos = `${result.score}%`
  const copyLine = `My ShiftGuard volatility score is ${result.score}/100 (${result.label}). ${result.weeksCounted} weeks measured.`

  return (
    <div>
      <ToolHeader
        icon={<Gauge className="w-4 h-4" />}
        title="Paycheck volatility score"
        subtitle="100 = rock steady, 0 = very swingy. Built from your weekly hour totals."
      />

      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">Your score</p>
            <p className="mt-1 text-5xl font-semibold text-white nums">{result.score}</p>
            <p className="text-sm text-slate-300 mt-1">{result.label}</p>
          </div>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(copyLine)}
            title="Copy"
            className="text-[11px] font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 inline-flex items-center gap-1.5"
          >
            <Share2 className="w-3 h-3" />
            Copy summary
          </button>
        </div>

        <div className="mt-4">
          <div className="relative h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-400 via-amber-400 to-green-400"
              style={{ width: pctPos }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-2">
            <span>very choppy</span>
            <span>steady</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <StatBox label="Weeks measured" value={result.weeksCounted} />
          <StatBox label="Avg hours / week" value={`${result.weeklyHoursMean}`} />
          <StatBox label="Std. dev" value={`±${result.weeklyHoursStddev}`} />
        </div>

        <p className="mt-4 text-[11px] text-slate-600 leading-relaxed">
          JPMorgan Chase Institute reports hourly workers see median monthly income swings of about 9%,
          and 1 in 4 months with swings of 21%+. Use the score to size your emergency buffer honestly.
        </p>
      </div>
    </div>
  )
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.16em]">{label}</p>
      <p className="text-white text-base font-semibold nums mt-0.5">{value}</p>
    </div>
  )
}
