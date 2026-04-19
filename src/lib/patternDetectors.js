import { calcShiftHours } from './utils'

/**
 * Deterministic shift-pattern signals (not GPT). Supports narrative + screening.
 */
export function detectShiftPatterns(shifts) {
  const list = Array.isArray(shifts) ? [...shifts].sort((a, b) => a.date.localeCompare(b.date)) : []
  const insights = []

  if (list.length < 2) {
    return { insights, meta: { shiftCount: list.length } }
  }

  const withHours = list.map(s => ({ ...s, hours: calcShiftHours(s) }))

  // Short turnaround (e.g. clopening-style schedules)
  for (let i = 1; i < withHours.length; i++) {
    const prev = withHours[i - 1]
    const cur = withHours[i]
    const gap = hoursBetweenShiftEndAndNextStart(prev, cur)
    if (gap !== null && gap < 10 && gap >= 0) {
      insights.push({
        id: `turnaround-${i}`,
        kind: 'short_turnaround',
        severity: gap < 8 ? 'high' : 'medium',
        title: 'Short turnaround between shifts',
        detail:
          `Less than ${gap < 8 ? '8' : '10'} hours between end of ${prev.date} and start of ${cur.date}. ` +
          'Some jurisdictions regulate minimum rest between shifts; this pattern also raises fatigue and scheduling fairness issues.',
      })
      break
    }
  }

  // Long shifts with very short breaks
  const longShortBreak = withHours.filter(s => s.hours >= 7.5 && (s.breakMinutes || 0) < 20)
  if (longShortBreak.length >= 2) {
    insights.push({
      id: 'compressed-breaks',
      kind: 'break_compression',
      severity: 'medium',
      title: 'Repeated long shifts with minimal breaks',
      detail: `${longShortBreak.length} shifts of 7.5h+ logged with under 20 minutes of break. Compare to your state meal/rest rules in the violation list.`,
    })
  }

  // Many consecutive workdays
  let streak = 1
  let maxStreak = 1
  for (let i = 1; i < list.length; i++) {
    if (daysApart(list[i - 1].date, list[i].date) === 1) {
      streak++
      maxStreak = Math.max(maxStreak, streak)
    } else {
      streak = 1
    }
  }
  if (maxStreak >= 7) {
    insights.push({
      id: 'long-streak',
      kind: 'consecutive_days',
      severity: 'low',
      title: 'Long streak of consecutive workdays',
      detail: `${maxStreak} consecutive calendar days with logged shifts. Some contracts or local rules address weekly rest; worth confirming against your schedule and pay.`,
    })
  }

  // OT flags vs long hours
  const otFlagged = list.filter(s => s.flaggedOT).length
  const heavy = withHours.filter(s => s.hours > 8).length
  if (heavy >= 2 && otFlagged === 0) {
    insights.push({
      id: 'ot-underreported',
      kind: 'ot_screening',
      severity: 'medium',
      title: 'Long days without overtime flags',
      detail:
        `${heavy} shifts exceed 8 hours but none are marked OT. If premium pay should apply, use the OT toggle on those shifts and re-run comparison.`,
    })
  }

  return { insights, meta: { shiftCount: list.length, maxConsecutiveDays: maxStreak } }
}

function daysApart(a, b) {
  const d0 = new Date(a + 'T12:00:00')
  const d1 = new Date(b + 'T12:00:00')
  return Math.round((d1 - d0) / (1000 * 60 * 60 * 24))
}

/**
 * Hours between previous shift clock-out and next shift clock-in (same calendar order).
 */
function hoursBetweenShiftEndAndNextStart(prev, cur) {
  const [pOutH, pOutM] = prev.clockOut.split(':').map(Number)
  const [cInH, cInM] = cur.clockIn.split(':').map(Number)
  if ([pOutH, pOutM, cInH, cInM].some(Number.isNaN)) return null

  const prevEnd = pOutH * 60 + pOutM
  const nextStart = cInH * 60 + cInM
  const dayGap = daysApart(prev.date, cur.date)
  if (dayGap < 0) return null
  if (dayGap === 0) {
    let diffMin = nextStart - prevEnd
    if (diffMin < 0) diffMin += 24 * 60
    return diffMin / 60
  }
  if (dayGap === 1) {
    const restFromMidnight = (24 * 60 - prevEnd + nextStart) / 60
    return restFromMidnight
  }
  return null
}
