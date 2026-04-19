import { calcShiftHours } from './utils'

/**
 * Windowing helpers for the Dashboard. Given a list of shifts, compute totals over the
 * requested timeframe ('day' | 'week' | 'month') plus the month-heatmap bucket for the
 * current month (for the calendar tile).
 *
 * All windows are computed in local time.
 */

function stripTime(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()) }

function startOfWeek(d) {
  // ISO week: Monday as the start. Keeps the toggle intuitive for most US hourly-worker
  // schedules (Sunday resets throw off the "this week" mental model).
  const day = (d.getDay() + 6) % 7
  const start = stripTime(d)
  start.setDate(start.getDate() - day)
  return start
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1) }

function withinWindow(dateISO, window) {
  if (!dateISO) return false
  const d = new Date(`${dateISO}T00:00:00`)
  if (Number.isNaN(d.valueOf())) return false
  return d >= window.start && d <= window.end
}

export function windowForTimeframe(timeframe, now = new Date()) {
  const today = stripTime(now)
  if (timeframe === 'day') {
    return { start: today, end: today, label: today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) }
  }
  if (timeframe === 'week') {
    const start = startOfWeek(now)
    const end = new Date(start); end.setDate(end.getDate() + 6)
    return { start, end, label: `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` }
  }
  const start = startOfMonth(now)
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
  return { start, end, label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
}

export function totalsForWindow(shifts, window) {
  let hours = 0, tips = 0, miles = 0, reimbursement = 0, count = 0
  for (const s of shifts || []) {
    if (!withinWindow(s.date, window)) continue
    count += 1
    hours += calcShiftHours(s)
    tips += Number(s.tips) || 0
    const m = Number(s.milesDriven) || 0
    miles += m
    reimbursement += m * (Number(s.reimbursementRate) || 0)
  }
  return {
    count,
    hours: Number(hours.toFixed(2)),
    tips: Number(tips.toFixed(2)),
    miles: Number(miles.toFixed(2)),
    reimbursement: Number(reimbursement.toFixed(2)),
  }
}

/**
 * Build a calendar heatmap of hours-per-day for the current month.
 * Returns { year, month, days: [{date, hours, shifts}], ... }
 */
export function monthHeatmap(shifts, now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const days = []
  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d)
    const iso = date.toISOString().slice(0, 10)
    const matching = (shifts || []).filter(s => s.date === iso)
    const hours = matching.reduce((sum, s) => sum + calcShiftHours(s), 0)
    days.push({ date: iso, hours: Number(hours.toFixed(2)), count: matching.length })
  }
  const leadingBlanks = (first.getDay() + 6) % 7  // Monday-first alignment
  const maxHours = days.reduce((m, d) => Math.max(m, d.hours), 0)
  return {
    year,
    month,
    label: first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    days,
    leadingBlanks,
    maxHours,
  }
}
