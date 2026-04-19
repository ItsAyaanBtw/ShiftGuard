import stateLaws, { getMinimumWage } from '../data/stateLaws'
import { calcShiftHours } from './utils'

/**
 * Paycheck verification: compares logged hours and premiums to pay stub and state rules.
 * Output uses neutral "discrepancy" language (not legal findings).
 *
 * @param {Object} params.prefs - From getUserPreferences(); enables healthcare premium estimates.
 */
export function analyzeWages({ shifts, paystub, stateCode, city, prefs }) {
  const state = stateLaws[stateCode]
  if (!state) throw new Error(`Unsupported state: ${stateCode}`)
  if (!shifts?.length) throw new Error('No shifts provided')
  if (!paystub) throw new Error('No pay stub data provided')

  const preferences = prefs || {}
  const rate = paystub.hourly_rate
  const discrepancies = []

  const hoursBreakdown = calculateHours(shifts, state)
  const totalTips = shifts.reduce((sum, s) => sum + (Number(s.tips) || 0), 0)
  const otFlaggedShifts = shifts.filter(s => s.flaggedOT).length

  let expectedRegularPay = round(hoursBreakdown.regularHours * rate)
  let expectedOTPay = round(hoursBreakdown.overtimeHours * rate * state.overtime.multiplier)
  let expectedDTPay = round(
    hoursBreakdown.doubleTimeHours * rate * (state.overtime.doubleTimeMultiplier || 2),
  )
  let expectedGross = round(expectedRegularPay + expectedOTPay + expectedDTPay + totalTips)

  const healthcareAddon = preferences.healthcareMode
    ? computeHealthcarePremiums(shifts, rate, preferences)
    : { total: 0, items: [] }

  for (const item of healthcareAddon.items) {
    discrepancies.push({
      type: item.type,
      difference: item.difference,
      explanation: item.explanation,
      suggestedAction: item.suggestedAction,
      severity: item.severity,
      lawNote: item.lawNote,
    })
  }

  expectedGross = round(expectedGross + healthcareAddon.total)

  const actualGross = paystub.gross_pay

  // --- Hours on pay advice vs logged ---
  const totalPaidHours = (paystub.hours_paid || 0) + (paystub.overtime_hours_paid || 0)
  const hoursDiff = round(hoursBreakdown.totalHoursWorked - totalPaidHours)
  if (hoursDiff > 0.25) {
    const amount = round(hoursDiff * rate)
    discrepancies.push({
      type: 'hours_shortfall',
      difference: amount,
      explanation:
        `You logged ${hoursBreakdown.totalHoursWorked.toFixed(1)} hours this period, but your pay advice ` +
        `shows ${totalPaidHours.toFixed(1)} paid hours. About ${hoursDiff.toFixed(1)} hours may not be reflected ` +
        `($${amount.toFixed(2)} at your base rate). Double-check the pay period dates and any PTO or leave codes.`,
      suggestedAction:
        'Compare your schedule and time punches to the earnings statement. Payroll can usually clarify a mismatch the same day.',
      severity: amount > 50 ? 'high' : 'medium',
      lawNote: state.statutes.payday,
    })
  }

  // --- Overtime premium ---
  const expectedOTHours = round(hoursBreakdown.overtimeHours + hoursBreakdown.doubleTimeHours)
  const paidOTHours = paystub.overtime_hours_paid || 0

  if (expectedOTHours > 0.25 && expectedOTHours > paidOTHours + 0.25) {
    const unpaidHours = round(expectedOTHours - paidOTHours)
    const premiumShortfall = round(unpaidHours * rate * (state.overtime.multiplier - 1))
    const otNote = otFlaggedShifts > 0
      ? ` You marked ${otFlaggedShifts} shift${otFlaggedShifts > 1 ? 's' : ''} as overtime.`
      : ''
    discrepancies.push({
      type: 'overtime_shortfall',
      difference: premiumShortfall,
      explanation:
        `About ${unpaidHours.toFixed(1)} hours look like overtime under common ${state.name} and federal rules, ` +
        `but your pay advice does not show enough overtime hours or premium pay. ` +
        `The difference is roughly $${premiumShortfall.toFixed(2)} in premium pay.${otNote}`,
      suggestedAction:
        'Ask payroll how overtime is calculated for your role and pay period. Many fixes are a settings or rounding issue.',
      severity: premiumShortfall > 50 ? 'high' : 'medium',
      lawNote: state.statutes.overtime,
    })
  }

  // --- California double-time ---
  if (state.overtime.type === 'daily_and_weekly' && hoursBreakdown.doubleTimeHours > 0.25) {
    const expectedDTTotal = round(hoursBreakdown.doubleTimeHours * rate * state.overtime.doubleTimeMultiplier)
    const paidOTRate = paystub.overtime_rate || (rate * state.overtime.multiplier)
    const paidAsDTHours = Math.min(hoursBreakdown.doubleTimeHours, paidOTHours)
    const paidDTValue = round(paidAsDTHours * paidOTRate)
    const dtShortfall = round(expectedDTTotal - paidDTValue)

    if (dtShortfall > 1) {
      discrepancies.push({
        type: 'double_time_shortfall',
        difference: dtShortfall,
        explanation:
          `${hoursBreakdown.doubleTimeHours.toFixed(1)} hours may qualify for double-time (long daily shifts in California). ` +
          `Your pay advice may not show the full double-time premium (about $${dtShortfall.toFixed(2)}).`,
        suggestedAction: 'Review daily hours with HR or payroll against your facility policy.',
        severity: 'high',
        lawNote: state.statutes.overtime,
      })
    }
  }

  // --- Minimum wage check (educational) ---
  const minWage = getMinimumWage(stateCode, city)
  if (hoursBreakdown.totalHoursWorked > 0 && rate > 0 && rate < minWage) {
    const deficit = round((minWage - rate) * hoursBreakdown.totalHoursWorked)
    discrepancies.push({
      type: 'minimum_wage_review',
      difference: deficit,
      explanation:
        `Your stated hourly rate ($${rate.toFixed(2)}) is below the typical minimum wage for ${city || state.name} ` +
        `($${minWage.toFixed(2)}/hr). Some roles have legal exceptions; this is a flag to verify classification and rates.`,
      suggestedAction:
        'Confirm your job classification and any tip credit or training wage with payroll or your state labor department’s materials.',
      severity: 'high',
      lawNote: state.statutes.minimumWage,
    })
  }

  discrepancies.push(...checkBreakDiscrepancies(shifts, state, rate))

  const itemized = round(discrepancies.reduce((sum, d) => sum + d.difference, 0))
  const grossDiff = round(expectedGross - actualGross)
  const unexplained = round(grossDiff - itemized)
  if (unexplained > 1) {
    discrepancies.push({
      type: 'gross_pay_review',
      difference: unexplained,
      explanation:
        `After line-item checks, about $${unexplained.toFixed(2)} of the gap between your modeled gross ` +
        `($${expectedGross.toFixed(2)}) and your pay advice gross ($${actualGross.toFixed(2)}) is not explained by the items above. ` +
        `Bonuses, different hourly jobs, or deductions labeled differently can cause this.`,
      suggestedAction:
        'Walk through each earnings code on your pay advice with payroll if the total still looks off.',
      severity: unexplained > 50 ? 'medium' : 'low',
      lawNote: state.statutes.payday,
    })
  }

  const totalDifference = round(discrepancies.reduce((sum, d) => sum + d.difference, 0))

  return {
    discrepancies,
    totalDifference,
    summary: {
      totalHoursWorked: round(hoursBreakdown.totalHoursWorked),
      regularHours: round(hoursBreakdown.regularHours),
      overtimeHours: round(hoursBreakdown.overtimeHours),
      doubleTimeHours: round(hoursBreakdown.doubleTimeHours),
      totalTips,
      expectedGross,
      healthcarePremiums: healthcareAddon.total,
      actualGross,
      discrepancy: grossDiff,
      hourlyRate: rate,
      dailyBreakdown: hoursBreakdown.dailyBreakdown,
    },
    state: {
      code: stateCode,
      name: state.name,
      agency: state.complaintAgency,
    },
  }
}

function computeHealthcarePremiums(shifts, baseRate, prefs) {
  const nightDiff = Number(prefs.nightDiff) || 0
  const weekendDiff = Number(prefs.weekendDiff) || 0
  const chargeDiff = Number(prefs.chargeNurseDiff) || 0
  const preceptorDiff = Number(prefs.preceptorDiff) || 0
  const holidayPerHr =
    prefs.holidayPremiumPerHour != null ? Number(prefs.holidayPremiumPerHour) : round(baseRate * 0.5)

  let nightHours = 0
  let weekendHours = 0
  let holidayHours = 0
  let chargeHours = 0
  let preceptorHours = 0

  for (const s of shifts) {
    const h = calcShiftHours(s)
    if (s.shiftType === 'night' || s.shiftType === 'evening') nightHours += h
    if (s.isWeekend) weekendHours += h
    if (s.isHoliday) holidayHours += h
    if (s.chargeNurse) chargeHours += h
    if (s.preceptor) preceptorHours += h
  }

  const items = []
  let total = 0

  if (nightHours > 0.25 && nightDiff > 0) {
    const d = round(nightHours * nightDiff)
    total += d
    items.push({
      type: 'night_differential_review',
      difference: d,
      explanation:
        `You logged ${nightHours.toFixed(1)} hours on night or evening shifts. At the premium you entered ` +
        `($${nightDiff.toFixed(2)}/hr), about $${d.toFixed(2)} would appear on your pay advice if differentials applied to all those hours. ` +
        `Your stub may use different shift windows or rates.`,
      suggestedAction:
        'Compare to your facility’s differential policy. Payroll can print an earnings code breakdown.',
      severity: d > 75 ? 'high' : 'medium',
    })
  }

  if (weekendHours > 0.25 && weekendDiff > 0) {
    const d = round(weekendHours * weekendDiff)
    total += d
    items.push({
      type: 'weekend_premium_review',
      difference: d,
      explanation:
        `You logged ${weekendHours.toFixed(1)} weekend hours. Using your entered weekend premium of ` +
        `$${weekendDiff.toFixed(2)}/hr, about $${d.toFixed(2)} would show if that premium applied to all weekend hours.`,
      suggestedAction: 'Confirm weekend premium rules for your unit and role.',
      severity: 'medium',
    })
  }

  if (holidayHours > 0.25 && holidayPerHr > 0) {
    const d = round(holidayHours * holidayPerHr)
    total += d
    items.push({
      type: 'holiday_premium_review',
      difference: d,
      explanation:
        `You logged ${holidayHours.toFixed(1)} hours on a marked holiday. Using $${holidayPerHr.toFixed(2)}/hr ` +
        `as the extra holiday premium, about $${d.toFixed(2)} may be missing if pay stayed at the base rate only.`,
      suggestedAction: 'Verify which holidays your employer pays at premium rates.',
      severity: d > 75 ? 'high' : 'medium',
    })
  }

  if (chargeHours > 0.25 && chargeDiff > 0) {
    const d = round(chargeHours * chargeDiff)
    total += d
    items.push({
      type: 'charge_nurse_differential_review',
      difference: d,
      explanation:
        `You logged ${chargeHours.toFixed(1)} hours with charge nurse duties. At $${chargeDiff.toFixed(2)}/hr ` +
        `extra, about $${d.toFixed(2)} would show if charge pay applied to all those hours.`,
      suggestedAction: 'Confirm your facility’s charge pay policy and earnings codes.',
      severity: d > 50 ? 'medium' : 'low',
    })
  }

  if (preceptorHours > 0.25 && preceptorDiff > 0) {
    const d = round(preceptorHours * preceptorDiff)
    total += d
    items.push({
      type: 'preceptor_differential_review',
      difference: d,
      explanation:
        `You logged ${preceptorHours.toFixed(1)} hours as preceptor. At $${preceptorDiff.toFixed(2)}/hr ` +
        `extra, about $${d.toFixed(2)} would show if preceptor pay applied to all those hours.`,
      suggestedAction: 'Confirm preceptor premiums with education or HR.',
      severity: d > 40 ? 'medium' : 'low',
    })
  }

  return { total: round(total), items }
}

function checkBreakDiscrepancies(shifts, state, rate) {
  const out = []
  const { breaks, statutes } = state

  if (!breaks.mealRequired && !breaks.restRequired) return out

  let mealCount = 0
  let restCount = 0

  shifts.forEach(shift => {
    const hours = calcShiftHours(shift)

    if (breaks.mealRequired && hours >= breaks.mealThresholdHours) {
      if (shift.breakMinutes < breaks.mealDurationMinutes) mealCount++
    }

    if (breaks.restRequired) {
      const requiredRests = Math.floor(hours / breaks.restPerHours)
      if (requiredRests > 0 && shift.breakMinutes < breaks.restDurationMinutes) restCount++
    }
  })

  if (mealCount > 0) {
    const penalty = breaks.penaltyPerViolation === 'one_hour_pay' ? round(mealCount * rate) : 0
    out.push({
      type: 'meal_break_review',
      difference: penalty,
      explanation:
        `${mealCount} long shift${mealCount > 1 ? 's' : ''} show shorter meal breaks than some states require. ` +
        (penalty > 0
          ? `In ${state.name}, a common penalty estimate is about $${penalty.toFixed(2)}; your employer’s policy may differ.`
          : 'Your state may require unpaid meal periods for long shifts.'),
      suggestedAction: 'Read your state labor department’s meal break page (linked in your paycheck report) and compare with your time records.',
      severity: 'medium',
      lawNote: statutes.breaks || statutes.payday,
    })
  }

  if (restCount > 0) {
    const penalty = breaks.penaltyPerViolation === 'one_hour_pay' ? round(restCount * rate) : 0
    out.push({
      type: 'rest_break_review',
      difference: penalty,
      explanation:
        `${restCount} shift${restCount > 1 ? 's' : ''} may be missing required rest breaks under ${state.name} rules.`,
      suggestedAction: 'If breaks were interrupted or skipped because of staffing, note dates and ask payroll how rest time is recorded.',
      severity: 'low',
      lawNote: statutes.breaks || statutes.payday,
    })
  }

  return out
}

function calculateHours(shifts, state) {
  const dailyBreakdown = shifts.map(shift => {
    const hours = calcShiftHours(shift)
    return { date: shift.date, hours, shift }
  })

  const totalHoursWorked = dailyBreakdown.reduce((sum, d) => sum + d.hours, 0)

  if (state.overtime.type === 'daily_and_weekly') {
    return calcCAOvertime(dailyBreakdown, state, totalHoursWorked)
  }
  return calcWeeklyOvertime(dailyBreakdown, state, totalHoursWorked)
}

function calcWeeklyOvertime(dailyBreakdown, state, totalHoursWorked) {
  const threshold = state.overtime.weeklyThreshold
  return {
    totalHoursWorked,
    regularHours: Math.min(totalHoursWorked, threshold),
    overtimeHours: Math.max(0, totalHoursWorked - threshold),
    doubleTimeHours: 0,
    dailyBreakdown,
  }
}

function calcCAOvertime(dailyBreakdown, state, totalHoursWorked) {
  let totalDailyRegular = 0
  let totalDailyOT = 0
  let totalDailyDT = 0

  const enriched = dailyBreakdown.map(d => {
    const h = d.hours
    const regular = Math.min(h, state.overtime.dailyThreshold)
    const ot = Math.max(0, Math.min(h, state.overtime.doubleTimeThreshold) - state.overtime.dailyThreshold)
    const dt = Math.max(0, h - state.overtime.doubleTimeThreshold)

    totalDailyRegular += regular
    totalDailyOT += ot
    totalDailyDT += dt

    return { ...d, regular, ot, dt }
  })

  const weeklyOT = Math.max(0, totalDailyRegular - state.overtime.weeklyThreshold)

  return {
    totalHoursWorked,
    regularHours: totalDailyRegular - weeklyOT,
    overtimeHours: totalDailyOT + weeklyOT,
    doubleTimeHours: totalDailyDT,
    dailyBreakdown: enriched,
  }
}

function round(n) {
  return Math.round(Number(n) * 100) / 100
}
