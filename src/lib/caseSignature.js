/**
 * Deterministic case fingerprint for exhibit integrity / audit trail.
 * Not cryptographic proof of external facts; shows data stability for a given snapshot.
 */
export async function computeCaseFingerprint({ shifts, paystub, violations, stateCode, totalOwed }) {
  const canonical = stableStringify({
    stateCode,
    totalOwed: round4(totalOwed),
    shifts: (shifts || []).map(s => ({
      date: s.date,
      clockIn: s.clockIn,
      clockOut: s.clockOut,
      breakMinutes: s.breakMinutes ?? 0,
      tips: round4(Number(s.tips) || 0),
      flaggedOT: !!s.flaggedOT,
      shiftType: s.shiftType || '',
      isWeekend: !!s.isWeekend,
      isHoliday: !!s.isHoliday,
    })),
    paystub: paystub
      ? {
          employer_name: paystub.employer_name || '',
          pay_period_start: paystub.pay_period_start || '',
          pay_period_end: paystub.pay_period_end || '',
          hours_paid: round4(paystub.hours_paid),
          overtime_hours_paid: round4(paystub.overtime_hours_paid),
          hourly_rate: round4(paystub.hourly_rate),
          gross_pay: round4(paystub.gross_pay),
        }
      : null,
    violations: (violations || []).map(v => ({
      type: v.type,
      difference: round4(v.difference ?? v.dollarAmount ?? 0),
      severity: v.severity,
    })),
  })

  const enc = new TextEncoder().encode(canonical)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
  return { hex, canonicalLength: canonical.length }
}

/**
 * Weighted 0–100 score from rule-engine line items (no LLM).
 */
export function computeRiskScore(violations, totalOwed) {
  const list = Array.isArray(violations) ? violations : []
  if (list.length === 0) return { score: 0, band: 'none', factors: [] }

  const weights = {
    unpaid_double_time: 22,
    double_time_shortfall: 22,
    minimum_wage: 20,
    minimum_wage_review: 20,
    unpaid_overtime: 16,
    overtime_shortfall: 16,
    missing_hours: 14,
    hours_shortfall: 14,
    pay_discrepancy: 12,
    gross_pay_review: 12,
    meal_break_violation: 10,
    meal_break_review: 10,
    night_differential_review: 10,
    weekend_premium_review: 10,
    holiday_premium_review: 10,
    charge_nurse_differential_review: 9,
    preceptor_differential_review: 9,
    rest_break_violation: 6,
    rest_break_review: 6,
  }

  let raw = 0
  const factors = []
  for (const v of list) {
    const w = weights[v.type] ?? 8
    raw += w
    factors.push({ type: v.type, weight: w })
  }

  const amountBoost = Math.min(25, Math.log10(1 + Math.max(0, totalOwed)) * 8)
  raw += amountBoost

  const score = Math.min(100, Math.round(raw))
  let band = 'elevated'
  if (score >= 75) band = 'critical'
  else if (score >= 45) band = 'high'
  else if (score >= 20) band = 'moderate'

  return { score, band, factors, amountBoost: round4(amountBoost) }
}

function round4(n) {
  return Math.round(Number(n) * 10000) / 10000
}

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj)
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`
  const keys = Object.keys(obj).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`
}
