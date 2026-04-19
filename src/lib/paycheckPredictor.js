import { getShifts, getUserPreferences, getPaystub, getUserState } from './storage'
import { calcShiftHours } from './utils'
import { estimateTakeHome } from './taxEstimator'
import { nextPayday } from './payCycle'

/**
 * Paycheck predictor. Projects what the next one or two paychecks will look like from:
 *   - shifts already logged in the current pay period (worked hours + mileage-derived tips)
 *   - the user's pay frequency and last pay date (prefs)
 *   - their last paystub (base rate, OT rate, deductions pattern)
 *   - the tax estimator for take-home projection
 *
 * Returns a list of projections ordered by payday, each with gross, deductions estimate,
 * and take-home estimate. Nothing in here calls the network; it's all derived from local
 * state.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

function freqToDays(freq) {
  switch (freq) {
    case 'weekly': return 7
    case 'biweekly': return 14
    case 'semimonthly': return 15
    case 'monthly': return 30
    default: return 14
  }
}

function parseDate(iso) {
  if (!iso) return null
  const d = new Date(String(iso).length === 10 ? `${iso}T00:00:00` : iso)
  return Number.isNaN(d.valueOf()) ? null : d
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function projectNextPaychecks({ periods = 2 } = {}) {
  const shifts = getShifts()
  const prefs = getUserPreferences()
  const paystub = getPaystub()
  const stateCode = getUserState() || 'US'

  const rate = Number(paystub?.hourly_rate) || 0
  const otRate = Number(paystub?.overtime_rate) || rate * 1.5
  const freq = prefs.payFrequency || 'biweekly'
  const freqDays = freqToDays(freq)
  const anchor = parseDate(prefs.lastPayDate) || parseDate(paystub?.pay_date) || parseDate(paystub?.pay_period_end)
  if (!anchor) {
    return { projections: [], reason: 'Set a last pay date in the Next paycheck planner to get projections.' }
  }

  // Build period windows that start one day after the anchor and advance by freq.
  const windows = []
  let cursor = stripTime(anchor)
  for (let i = 0; i < periods; i++) {
    const start = new Date(cursor.getTime() + MS_PER_DAY)
    const end = new Date(start.getTime() + (freqDays - 1) * MS_PER_DAY)
    const payday = nextPayday({
      payFrequency: freq,
      lastPayDate: cursor.toISOString().slice(0, 10),
      paystub,
    })
    windows.push({ start, end, payday })
    cursor = new Date(cursor.getTime() + freqDays * MS_PER_DAY)
  }

  // Aggregate hours in each window from logged shifts.
  const projections = windows.map(win => {
    const startKey = win.start.toISOString().slice(0, 10)
    const endKey = win.end.toISOString().slice(0, 10)

    let totalHours = 0
    let totalTips = 0
    let totalMiles = 0
    let shiftCount = 0
    for (const s of shifts) {
      if (!s?.date) continue
      if (s.date < startKey || s.date > endKey) continue
      totalHours += calcShiftHours(s)
      totalTips += Number(s.tips) || 0
      totalMiles += Number(s.milesDriven) || 0
      shiftCount += 1
    }

    const regularHours = Math.min(40 * (freqDays / 7), totalHours)
    const otHours = Math.max(0, totalHours - regularHours)
    const projectedGross = Math.max(0, regularHours * rate + otHours * otRate + totalTips)

    const take = estimateTakeHome({
      grossThisCheck: projectedGross,
      annualizeOver: freq,
      stateCode,
      filingStatus: prefs.filingStatus || 'single',
      dependents: prefs.dependents || 0,
    })

    return {
      periodStart: startKey,
      periodEnd: endKey,
      payday: win.payday ? win.payday.toISOString().slice(0, 10) : '',
      shiftCount,
      hours: Number(totalHours.toFixed(2)),
      tips: Number(totalTips.toFixed(2)),
      miles: Number(totalMiles.toFixed(2)),
      projectedGross: Number(projectedGross.toFixed(2)),
      estimatedTax: Number(take.totalTax.toFixed(2)),
      estimatedNet: Number(take.net.toFixed(2)),
      effectiveRate: take.effectiveRate,
    }
  })

  return { projections, reason: null }
}

/**
 * Sum the take-home across the next N periods for a month-level planning view.
 */
export function projectMonthlyTakeHome({ periods = 2 } = {}) {
  const { projections, reason } = projectNextPaychecks({ periods })
  if (!projections.length) return { total: 0, projections, reason }
  const total = projections.reduce((s, p) => s + (p.estimatedNet || 0), 0)
  return { total: Number(total.toFixed(2)), projections, reason }
}
