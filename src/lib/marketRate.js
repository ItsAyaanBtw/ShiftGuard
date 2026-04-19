import { getMarketRate, OCCUPATIONS, STATES_WITH_DATA } from '../data/marketRates'

/**
 * Compares a worker's base hourly rate against the BLS OEWS distribution for their
 * role + state and returns a percentile band label.
 *
 * OEWS only publishes 25/50/75 percentiles per cell, so we infer percentile via
 * piecewise-linear interpolation anchored at three known points:
 *     p(rate <= p25)  = 0   … 25
 *     p(p25..median)  = 25  … 50
 *     p(median..p75)  = 50  … 75
 *     p(rate > p75)   = 75  … 100 (capped at 95)
 *
 * This is a rough but honest estimate. We surface the band as text ("at the 31st
 * percentile") and never claim higher precision than that.
 */

export function analyzeMarketRate({ hourlyRate, stateCode, occupationCode }) {
  const rate = Number(hourlyRate)
  if (!Number.isFinite(rate) || rate <= 0) {
    return { status: 'no-rate' }
  }
  if (!occupationCode) {
    return { status: 'no-occupation' }
  }

  const stateRow = getMarketRate(stateCode, occupationCode)
  const nationalRow = getMarketRate('US', occupationCode)
  const row = stateRow || nationalRow
  if (!row) return { status: 'no-data' }

  const percentile = inferPercentile(rate, row)
  const occupation = OCCUPATIONS.find(o => o.code === occupationCode)
  const delta = rate - row.median
  const belowMedianPct = rate < row.median
    ? Math.round(((row.median - rate) / row.median) * 100)
    : 0
  const aboveMedianPct = rate > row.median
    ? Math.round(((rate - row.median) / row.median) * 100)
    : 0

  return {
    status: 'ok',
    rate,
    stateCode: stateRow ? stateCode : 'US',
    stateFallback: !stateRow,
    occupation: occupation?.label || occupationCode,
    occupationCode,
    p25: row.p25,
    median: row.median,
    p75: row.p75,
    delta: Number(delta.toFixed(2)),
    percentile,
    band: bandLabel(percentile),
    belowMedianPct,
    aboveMedianPct,
  }
}

function inferPercentile(rate, row) {
  const { p25, median, p75 } = row
  if (rate <= p25) {
    const floor = Math.max(1, p25 - (median - p25))
    const pos = (rate - floor) / (p25 - floor)
    return clamp(Math.round(pos * 25), 2, 25)
  }
  if (rate <= median) {
    const pos = (rate - p25) / (median - p25)
    return clamp(Math.round(25 + pos * 25), 25, 50)
  }
  if (rate <= p75) {
    const pos = (rate - median) / (p75 - median)
    return clamp(Math.round(50 + pos * 25), 50, 75)
  }
  const ceiling = p75 + (p75 - median)
  const pos = (rate - p75) / Math.max(0.01, ceiling - p75)
  return clamp(Math.round(75 + pos * 20), 75, 95)
}

function bandLabel(percentile) {
  if (percentile < 25) return 'Below the first quartile'
  if (percentile < 40) return 'Below median'
  if (percentile <= 60) return 'Near the median'
  if (percentile <= 75) return 'Above median'
  return 'Top quartile'
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)) }

export { OCCUPATIONS, STATES_WITH_DATA }
