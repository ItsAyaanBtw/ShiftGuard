/**
 * Next-payday computation.
 *
 * Pay frequencies supported:
 *   - weekly      : every 7 days from lastPayDate
 *   - biweekly    : every 14 days from lastPayDate
 *   - semimonthly : the 15th and last day of each month (most common pattern in US payroll)
 *   - monthly     : once a month, same day-of-month as lastPayDate
 *
 * If the user has not filled in `lastPayDate`, we fall back to the most recent pay stub's
 * `pay_date` or, failing that, `pay_period_end`. If nothing is known, the function returns
 * `null` so the UI can render an empty-state prompt instead of guessing.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function nextPayday({ payFrequency, lastPayDate, paystub, now = new Date() } = {}) {
  const anchor = parseISODate(lastPayDate) || stubPayAnchor(paystub)
  if (!anchor) return null

  const freq = payFrequency || 'biweekly'
  const today = stripTime(now)
  const anchorDay = stripTime(anchor)

  switch (freq) {
    case 'weekly':   return projectFixedInterval(anchorDay, today, 7)
    case 'biweekly': return projectFixedInterval(anchorDay, today, 14)
    case 'monthly':  return projectMonthly(anchorDay, today)
    case 'semimonthly':
    default:
      if (freq === 'semimonthly') return projectSemiMonthly(today)
      return projectFixedInterval(anchorDay, today, 14)
  }
}

export function daysUntil(dateISO, now = new Date()) {
  const d = typeof dateISO === 'string' ? parseISODate(dateISO) : dateISO
  if (!d) return null
  return Math.round((stripTime(d) - stripTime(now)) / MS_PER_DAY)
}

export function formatShortDate(dateISO) {
  const d = typeof dateISO === 'string' ? parseISODate(dateISO) : dateISO
  if (!d) return ''
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function projectFixedInterval(anchor, today, intervalDays) {
  if (!anchor) return null
  if (today < anchor) return anchor
  const diffDays = Math.floor((today - anchor) / MS_PER_DAY)
  const cyclesSince = Math.floor(diffDays / intervalDays) + 1
  return new Date(anchor.getTime() + cyclesSince * intervalDays * MS_PER_DAY)
}

function projectMonthly(anchor, today) {
  const day = anchor.getDate()
  const candidate = new Date(today.getFullYear(), today.getMonth(), day)
  if (candidate > today) return candidate
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const lastOfNext = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate()
  return new Date(nextMonth.getFullYear(), nextMonth.getMonth(), Math.min(day, lastOfNext))
}

/** Semi-monthly fires on the 15th and the last calendar day. */
function projectSemiMonthly(today) {
  const y = today.getFullYear()
  const m = today.getMonth()
  const lastOfMonth = new Date(y, m + 1, 0).getDate()
  const fifteenth = new Date(y, m, 15)
  const last = new Date(y, m, lastOfMonth)

  if (today < fifteenth) return fifteenth
  if (today < last) return last
  return new Date(y, m + 1, 15)
}

function stubPayAnchor(paystub) {
  if (!paystub) return null
  return parseISODate(paystub.pay_date) || parseISODate(paystub.pay_period_end)
}

function parseISODate(v) {
  if (!v) return null
  const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v)
  return Number.isNaN(d.valueOf()) ? null : d
}

function stripTime(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}
