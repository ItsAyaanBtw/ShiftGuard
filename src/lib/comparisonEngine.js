import stateLaws, { getMinimumWage } from '../data/stateLaws'
import { calcShiftHours } from './utils'

/**
 * Core comparison engine for ShiftGuard.
 *
 * @param {Object} params
 * @param {Array<Object>} params.shifts - Worker-logged shift entries.
 * @param {Object} params.paystub - Parsed pay stub data (snake_case from Claude).
 * @param {string} params.stateCode - 'TX' | 'CA' | 'NY' | 'FL'
 * @param {string} [params.city] - Optional city for local minimum wage overrides.
 * @returns {Object} Analysis result with violations, totalOwed, summary, recommendedAction.
 */
export function analyzeWages({ shifts, paystub, stateCode, city }) {
  const state = stateLaws[stateCode]
  if (!state) throw new Error(`Unsupported state: ${stateCode}`)
  if (!shifts?.length) throw new Error('No shifts provided')
  if (!paystub) throw new Error('No pay stub data provided')

  const rate = paystub.hourly_rate
  const violations = []

  const hoursBreakdown = calculateHours(shifts, state)
  const totalTips = shifts.reduce((sum, s) => sum + (Number(s.tips) || 0), 0)
  const otFlaggedShifts = shifts.filter(s => s.flaggedOT).length

  // Expected wages per CONTEXT.md: regular + OT + double time + tips
  const expectedRegularPay = round(hoursBreakdown.regularHours * rate)
  const expectedOTPay = round(hoursBreakdown.overtimeHours * rate * state.overtime.multiplier)
  const expectedDTPay = round(
    hoursBreakdown.doubleTimeHours * rate * (state.overtime.doubleTimeMultiplier || 2)
  )
  const expectedGross = round(expectedRegularPay + expectedOTPay + expectedDTPay + totalTips)
  const actualGross = paystub.gross_pay

  // --- Violation checks ---

  // 1. Missing hours
  const totalPaidHours = (paystub.hours_paid || 0) + (paystub.overtime_hours_paid || 0)
  const hoursDiff = round(hoursBreakdown.totalHoursWorked - totalPaidHours)
  if (hoursDiff > 0.25) {
    const amount = round(hoursDiff * rate)
    violations.push({
      type: 'missing_hours',
      dollarAmount: amount,
      citation: state.statutes.payday,
      severity: amount > 50 ? 'high' : 'medium',
      explanation:
        `You logged ${hoursBreakdown.totalHoursWorked.toFixed(1)} hours but your pay stub ` +
        `shows ${totalPaidHours.toFixed(1)} hours. ` +
        `${hoursDiff.toFixed(1)} hours appear to be missing ($${amount.toFixed(2)}).`,
    })
  }

  // 2. Unpaid overtime
  const expectedOTHours = round(hoursBreakdown.overtimeHours + hoursBreakdown.doubleTimeHours)
  const paidOTHours = paystub.overtime_hours_paid || 0

  if (expectedOTHours > 0.25 && expectedOTHours > paidOTHours + 0.25) {
    const unpaidHours = round(expectedOTHours - paidOTHours)
    const unpaidOTAmount = round(unpaidHours * rate * (state.overtime.multiplier - 1))
    const otNote = otFlaggedShifts > 0
      ? ` You flagged ${otFlaggedShifts} shift${otFlaggedShifts > 1 ? 's' : ''} as overtime.`
      : ''
    violations.push({
      type: 'unpaid_overtime',
      dollarAmount: unpaidOTAmount,
      citation: state.statutes.overtime,
      severity: unpaidOTAmount > 50 ? 'high' : 'medium',
      explanation:
        `${unpaidHours.toFixed(1)} hours of overtime were not compensated at the required premium rate. ` +
        `Under ${state.statutes.overtime}, your employer owes you ` +
        `$${unpaidOTAmount.toFixed(2)} in unpaid overtime wages.${otNote}`,
    })
  }

  // 3. CA double time: compare expected DT pay vs what a standard OT rate would cover
  if (state.overtime.type === 'daily_and_weekly' && hoursBreakdown.doubleTimeHours > 0.25) {
    const expectedDTTotal = round(hoursBreakdown.doubleTimeHours * rate * state.overtime.doubleTimeMultiplier)
    const paidOTRate = paystub.overtime_rate || (rate * state.overtime.multiplier)
    const paidAsDTHours = Math.min(hoursBreakdown.doubleTimeHours, paidOTHours)
    const paidDTValue = round(paidAsDTHours * paidOTRate)
    const dtShortfall = round(expectedDTTotal - paidDTValue)

    if (dtShortfall > 1) {
      violations.push({
        type: 'unpaid_double_time',
        dollarAmount: dtShortfall,
        citation: state.statutes.overtime,
        severity: 'high',
        explanation:
          `${hoursBreakdown.doubleTimeHours.toFixed(1)} hours qualify for double-time pay (shifts over 12 hours in a day). ` +
          `The pay stub does not reflect the required 2x rate. ` +
          `Under ${state.statutes.overtime}, you may be owed an additional $${dtShortfall.toFixed(2)}.`,
      })
    }
  }

  // 4. Minimum wage compliance
  const minWage = getMinimumWage(stateCode, city)
  if (hoursBreakdown.totalHoursWorked > 0 && rate > 0 && rate < minWage) {
    const deficit = round((minWage - rate) * hoursBreakdown.totalHoursWorked)
    violations.push({
      type: 'minimum_wage',
      dollarAmount: deficit,
      citation: state.statutes.minimumWage,
      severity: 'high',
      explanation:
        `Your hourly rate of $${rate.toFixed(2)} is below ` +
        `the ${city || state.name} minimum wage of $${minWage.toFixed(2)}/hr. ` +
        `Under ${state.statutes.minimumWage}, you are owed $${deficit.toFixed(2)}.`,
    })
  }

  // 5. Break violations
  const breakViolations = checkBreakViolations(shifts, state, rate)
  violations.push(...breakViolations)

  // 6. Catch-all: unexplained gross pay discrepancy
  const totalViolationDollars = violations.reduce((sum, v) => sum + v.dollarAmount, 0)
  const grossDiff = round(expectedGross - actualGross)
  const unexplained = round(grossDiff - totalViolationDollars)
  if (unexplained > 1) {
    violations.push({
      type: 'pay_discrepancy',
      dollarAmount: unexplained,
      citation: state.statutes.payday,
      severity: unexplained > 50 ? 'high' : 'low',
      explanation:
        `After accounting for all identified violations, there is still ` +
        `$${unexplained.toFixed(2)} in unexplained missing pay between your expected gross ` +
        `($${expectedGross.toFixed(2)}) and your actual gross ($${actualGross.toFixed(2)}).`,
    })
  }

  const totalOwed = round(violations.reduce((sum, v) => sum + v.dollarAmount, 0))

  return {
    violations,
    totalOwed,
    summary: {
      totalHoursWorked: round(hoursBreakdown.totalHoursWorked),
      regularHours: round(hoursBreakdown.regularHours),
      overtimeHours: round(hoursBreakdown.overtimeHours),
      doubleTimeHours: round(hoursBreakdown.doubleTimeHours),
      totalTips,
      expectedGross,
      actualGross,
      discrepancy: grossDiff,
      hourlyRate: rate,
      dailyBreakdown: hoursBreakdown.dailyBreakdown,
    },
    recommendedAction: getRecommendedAction(totalOwed),
    state: {
      code: stateCode,
      name: state.name,
      agency: state.complaintAgency,
    },
  }
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

function checkBreakViolations(shifts, state, rate) {
  const violations = []
  const { breaks, statutes } = state

  if (!breaks.mealRequired && !breaks.restRequired) return violations

  let mealViolationCount = 0
  let restViolationCount = 0

  shifts.forEach(shift => {
    const hours = calcShiftHours(shift)

    if (breaks.mealRequired && hours >= breaks.mealThresholdHours) {
      if (shift.breakMinutes < breaks.mealDurationMinutes) {
        mealViolationCount++
      }
    }

    if (breaks.restRequired) {
      const requiredRests = Math.floor(hours / breaks.restPerHours)
      if (requiredRests > 0 && shift.breakMinutes < breaks.restDurationMinutes) {
        restViolationCount++
      }
    }
  })

  if (mealViolationCount > 0) {
    const penalty = breaks.penaltyPerViolation === 'one_hour_pay'
      ? round(mealViolationCount * rate)
      : 0
    violations.push({
      type: 'meal_break_violation',
      dollarAmount: penalty,
      citation: statutes.breaks || statutes.payday,
      severity: 'medium',
      explanation:
        `${mealViolationCount} shift${mealViolationCount > 1 ? 's' : ''} of ${breaks.mealThresholdHours}+ hours ` +
        `did not include the required ${breaks.mealDurationMinutes}-minute meal break. ` +
        (penalty > 0
          ? `Under ${statutes.breaks}, you may be owed $${penalty.toFixed(2)} in meal break penalties.`
          : `Under state law, your employer must provide adequate meal breaks.`),
    })
  }

  if (restViolationCount > 0) {
    const penalty = breaks.penaltyPerViolation === 'one_hour_pay'
      ? round(restViolationCount * rate)
      : 0
    violations.push({
      type: 'rest_break_violation',
      dollarAmount: penalty,
      citation: statutes.breaks || statutes.payday,
      severity: 'low',
      explanation:
        `${restViolationCount} shift${restViolationCount > 1 ? 's' : ''} appear to be missing the required ` +
        `${breaks.restDurationMinutes}-minute rest break per ${breaks.restPerHours} hours worked. ` +
        (penalty > 0
          ? `Under ${statutes.breaks}, you may be owed $${penalty.toFixed(2)} in rest break penalties.`
          : `Under state law, your employer must provide adequate rest breaks.`),
    })
  }

  return violations
}

function getRecommendedAction(totalOwed) {
  if (totalOwed <= 0) return 'none'
  if (totalOwed >= 500) return 'attorney_referral'
  if (totalOwed >= 100) return 'state_complaint'
  return 'demand_letter'
}

function round(n) {
  return Math.round(n * 100) / 100
}
