/**
 * State overtime rules currently in force, with the citations users can verify.
 *
 * Sources (April 2026):
 *   - Federal FLSA 29 USC 207(a): time-and-a-half after 40 hrs in a workweek.
 *   - California Labor Code Section 510(a) + IWC Wage Orders: daily OT after 8 hrs at
 *     1.5x, after 12 hrs at 2x, plus 7th-consecutive-day premium (1.5x for the first
 *     8 hrs and 2x beyond) when the worker has worked all seven days of the workweek.
 *   - New York Labor Law and 12 NYCRR Part 142: 40 hrs/week at 1.5x for most hourly
 *     workers (residential employees use 44 hrs).
 *   - Texas: follows FLSA only, no daily OT.
 *   - Florida: follows FLSA only, no daily OT.
 *
 * The shape returned by computeOvertimeBreakdown lets the UI render a clean breakdown
 * table without re-implementing the rule logic in JSX.
 */

export const STATE_OT_RULES = {
  CA: {
    name: 'California',
    summary: 'Daily 1.5x after 8 hrs and 2x after 12 hrs. 1.5x after 40 hrs per week. Seventh consecutive workday: 1.5x for the first 8 hrs, 2x beyond.',
    citation: 'CA Labor Code Section 510(a); IWC Wage Orders 1-17',
    daily: { threshold15x: 8, threshold2x: 12 },
    weeklyThreshold: 40,
    seventhDay: { threshold15x: 0, threshold2x: 8 }, // 1.5x kicks in immediately, 2x past 8h
  },
  NY: {
    name: 'New York',
    summary: 'Time-and-a-half after 40 hrs in a workweek (44 hrs for residential employees). No daily OT.',
    citation: '12 NYCRR Part 142-2.2; NY Labor Law Article 19',
    daily: null,
    weeklyThreshold: 40,
    seventhDay: null,
  },
  TX: {
    name: 'Texas',
    summary: 'Follows the federal FLSA only. Time-and-a-half after 40 hrs in a workweek. No daily OT.',
    citation: 'FLSA 29 USC 207(a); Texas Payday Law (no state OT)',
    daily: null,
    weeklyThreshold: 40,
    seventhDay: null,
  },
  FL: {
    name: 'Florida',
    summary: 'Follows the federal FLSA only. Time-and-a-half after 40 hrs in a workweek. No daily OT.',
    citation: 'FLSA 29 USC 207(a); FL has no state-level OT statute',
    daily: null,
    weeklyThreshold: 40,
    seventhDay: null,
  },
}

export const FALLBACK_OT_RULE = {
  name: 'Federal default',
  summary: 'Federal FLSA: time-and-a-half after 40 hrs in a workweek.',
  citation: 'FLSA 29 USC 207(a)',
  daily: null,
  weeklyThreshold: 40,
  seventhDay: null,
}

export function getOtRule(stateCode) {
  return STATE_OT_RULES[stateCode] || FALLBACK_OT_RULE
}

/**
 * Compute the overtime breakdown for the given week using the state's rule.
 *
 * `dailyHours` is an array of 7 numbers (Sunday-first), each the hours worked that day.
 * `consecutiveStart` is the day index the current consecutive streak started, used for
 * the CA seventh-day rule. If unspecified we just check whether all 7 days have hours.
 *
 * Returns:
 *   { regularHours, overtime15Hours, overtime2Hours, totalHours, ruleApplied }
 */
export function computeOvertimeBreakdown({ dailyHours, stateCode, hourlyRate = 0 }) {
  const days = Array.isArray(dailyHours) && dailyHours.length === 7
    ? dailyHours.map(n => Math.max(0, Number(n) || 0))
    : new Array(7).fill(0)
  const rule = getOtRule(stateCode)
  let regular = 0
  let ot15 = 0
  let ot2 = 0

  const allSevenDaysWorked = days.every(h => h > 0)

  // Daily and seventh-day buckets first (CA only).
  for (let i = 0; i < 7; i++) {
    const h = days[i]
    if (h <= 0) continue

    // Seventh consecutive workday in CA: every hour goes to OT15 (with OT2 past 8).
    if (allSevenDaysWorked && rule.seventhDay && i === 6) {
      const ot2Hours = Math.max(0, h - rule.seventhDay.threshold2x)
      const ot15Hours = h - ot2Hours
      ot15 += ot15Hours
      ot2 += ot2Hours
      continue
    }

    if (rule.daily) {
      const dt = Math.max(0, h - rule.daily.threshold2x)
      const ot = Math.max(0, Math.min(h, rule.daily.threshold2x) - rule.daily.threshold15x)
      const reg = h - dt - ot
      regular += reg
      ot15 += ot
      ot2 += dt
    } else {
      regular += h
    }
  }

  // Weekly OT bucket: only the regular bucket is eligible to spill into 1.5x. We do this
  // after the daily pass so CA workers don't double-count daily OT into weekly OT.
  if (rule.weeklyThreshold && regular > rule.weeklyThreshold) {
    const overspill = regular - rule.weeklyThreshold
    regular = rule.weeklyThreshold
    ot15 += overspill
  }

  const round = n => Math.round(n * 100) / 100
  const rate = Math.max(0, Number(hourlyRate) || 0)

  return {
    state: rule.name,
    citation: rule.citation,
    summary: rule.summary,
    regularHours: round(regular),
    overtime15Hours: round(ot15),
    overtime2Hours: round(ot2),
    totalHours: round(regular + ot15 + ot2),
    pay: rate > 0 ? {
      regular: round(regular * rate),
      overtime15: round(ot15 * rate * 1.5),
      overtime2: round(ot2 * rate * 2),
      total: round(regular * rate + ot15 * rate * 1.5 + ot2 * rate * 2),
    } : null,
    ruleApplied: rule,
    sevenDayRuleTriggered: allSevenDaysWorked && rule.seventhDay != null,
  }
}
