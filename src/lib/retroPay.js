import { getVerificationHistory } from './storage'

/**
 * Estimates potentially owed wages across historical paycheck checks.
 *
 * The math is intentionally conservative: we take the latest `totalDifference` for each
 * distinct pay period (so re-runs don't double-count), apply a state-specific lookback
 * window, and return both the capped lookback estimate and the uncapped total-on-file so
 * the UI can honestly show both.
 *
 * State lookback rules (most common, hourly workers):
 *   - CA:   Labor Code §200 + UCL (Business & Professions §17200): 3 years (4 for UCL).
 *   - NY:   NY Labor Law §198: 6 years.
 *   - FL:   FLSA only: 2 years, 3 if willful.
 *   - TX:   FLSA only: 2 years, 3 if willful.
 *   - US:   FLSA fallback: 2 years (non-willful).
 *
 * Output is an *estimate*. Callers MUST frame it as informational, not a legal opinion.
 */

const LOOKBACK_MONTHS_BY_STATE = {
  CA: 36,
  NY: 72,
  FL: 24,
  TX: 24,
  US: 24,
}

/** State statute citation. The UI should render this small and keep it visible. */
const LOOKBACK_CITATION = {
  CA: 'CA Labor Code §200; UCL §17200 (4-yr)',
  NY: 'NY Labor Law §198 (6-yr)',
  FL: 'FLSA §255 (2-yr, 3-yr willful)',
  TX: 'FLSA §255 (2-yr, 3-yr willful)',
  US: 'FLSA §255 (2-yr, 3-yr willful)',
}

function monthsBetween(laterISO, earlierISO) {
  const later = new Date(laterISO)
  const earlier = new Date(earlierISO)
  return (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth())
}

/**
 * Aggregate the latest flagged amount per distinct pay period within the statute lookback.
 * Returns dollar totals and a breakdown by period.
 */
export function computeRetroPayEstimate({ stateCode = 'US', now = new Date() } = {}) {
  const lookbackMonths = LOOKBACK_MONTHS_BY_STATE[stateCode] ?? LOOKBACK_MONTHS_BY_STATE.US
  const citation = LOOKBACK_CITATION[stateCode] ?? LOOKBACK_CITATION.US
  const history = getVerificationHistory()

  const latestByKey = new Map()
  for (const entry of history) {
    const key = entry.paystubKey || entry.at
    if (!latestByKey.has(key)) {
      latestByKey.set(key, entry)
    }
  }

  const allEntries = [...latestByKey.values()]
    .map(e => ({ ...e, totalDifference: Number(e.totalDifference) || 0 }))
    .filter(e => e.totalDifference > 0)

  const inWindow = []
  const outsideWindow = []
  for (const entry of allEntries) {
    const anchor = entry.periodEnd || entry.at
    if (!anchor) continue
    const age = monthsBetween(now, anchor)
    if (age <= lookbackMonths) inWindow.push(entry)
    else outsideWindow.push(entry)
  }

  const sum = arr => arr.reduce((s, e) => s + e.totalDifference, 0)
  const totalInWindow = roundMoney(sum(inWindow))
  const totalOnFile = roundMoney(sum(allEntries))

  inWindow.sort((a, b) => (b.periodEnd || '').localeCompare(a.periodEnd || ''))

  return {
    stateCode,
    lookbackMonths,
    lookbackLabel: `${Math.round(lookbackMonths / 12 * 10) / 10} years`,
    citation,
    totalInWindow,
    totalOnFile,
    periodsInWindow: inWindow.length,
    periodsOutsideWindow: outsideWindow.length,
    breakdown: inWindow.map(e => ({
      paystubKey: e.paystubKey,
      employer: e.employer || '',
      periodStart: e.periodStart || '',
      periodEnd: e.periodEnd || '',
      amount: roundMoney(e.totalDifference),
    })),
  }
}

function roundMoney(n) {
  return Math.round(Number(n) * 100) / 100
}
