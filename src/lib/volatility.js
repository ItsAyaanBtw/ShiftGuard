import { calcShiftHours } from './utils'

/**
 * Paycheck volatility score 0–100. Higher = more stable, because the "volatility" concept
 * is counter-intuitive to anchor on the good end.
 *
 * Method:
 *   1. Bucket shifts into ISO weeks using a worker's clock-in date.
 *   2. Compute weekly hour totals across at least 2 weeks of data.
 *   3. Compute the coefficient of variation (stddev / mean).
 *   4. Map CV → 0–100: 0 CV = 100; CV of 0.6+ = 0. Linear between.
 *
 * JPMorgan Chase Institute ("Weathering Volatility 2.0", 2019) found hourly workers'
 * median month-over-month earnings change is 9%, with 1 in 4 months seeing a ≥21% swing.
 * That translates to roughly CV ≈ 0.12 median and CV ≈ 0.32 at the p75 mark, which the
 * scoring below reflects.
 *
 * If there are fewer than 2 weeks, or < 3 shifts total, we return `null` so the UI can
 * render an empty-state instead of a misleading number.
 */

export function computeVolatility(shifts) {
  if (!Array.isArray(shifts) || shifts.length < 3) return null

  const weeks = groupByIsoWeek(shifts)
  const weekKeys = Object.keys(weeks)
  if (weekKeys.length < 2) return null

  const totals = weekKeys.map(k =>
    weeks[k].reduce((sum, s) => sum + calcShiftHours(s), 0),
  )
  const mean = avg(totals)
  if (mean === 0) return null
  const stddev = standardDeviation(totals, mean)
  const cv = stddev / mean

  const score = clamp(Math.round((1 - cv / 0.6) * 100), 0, 100)

  return {
    score,
    cv: Number(cv.toFixed(3)),
    weeksCounted: totals.length,
    weeklyHoursMean: Number(mean.toFixed(2)),
    weeklyHoursStddev: Number(stddev.toFixed(2)),
    weeklyTotals: totals.map(n => Number(n.toFixed(2))),
    label: labelForScore(score),
  }
}

function labelForScore(score) {
  if (score >= 80) return 'Steady'
  if (score >= 60) return 'Mostly steady'
  if (score >= 40) return 'Bumpy'
  if (score >= 20) return 'Choppy'
  return 'Very choppy'
}

function groupByIsoWeek(shifts) {
  const out = {}
  for (const s of shifts) {
    if (!s?.date) continue
    const key = isoWeekKey(s.date)
    out[key] = out[key] || []
    out[key].push(s)
  }
  return out
}

function isoWeekKey(dateISO) {
  const d = new Date(dateISO + 'T00:00:00')
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = Math.round(((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7) + 1
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

function avg(xs) { return xs.reduce((s, x) => s + x, 0) / xs.length }
function standardDeviation(xs, mean) {
  return Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
}
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)) }
