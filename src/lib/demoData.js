import { saveShifts, savePaystub, savePaystubImage, saveUserState, saveUserCity, clearAll } from './storage'

/**
 * Maria: Restaurant server, Austin TX.
 * 44 hours (Mon-Fri 8h + Sat 4h). Paid for 40 flat. 4h unpaid OT.
 * Matches the CONTEXT.md demo script exactly.
 *
 * James: Construction laborer, Los Angeles CA.
 * 48 hours over 5 days (Mon-Thu 10h, Fri 8h). CA daily OT kicks in at 8h/day.
 * Paid 40h flat at $18. Missing 8h daily OT.
 *
 * Priya: Home health aide, NYC NY.
 * 48 hours over 6 days (Mon-Fri 8h + Sat 8h). Paid 40h flat at $16.50.
 * Missing 8h and 8h unpaid OT.
 */
export const DEMO_SCENARIOS = [
  {
    id: 'maria',
    name: 'Maria, 34',
    role: 'Restaurant server in Austin, TX',
    industry: 'Food Service',
    stubImage: '/demo/paystub-maria.svg',
    summary: '44 hours worked, paid for 40. 4 hours of unpaid overtime at $15/hr.',
    tagline: '$90 stolen this pay period',
    stateCode: 'TX',
    city: null,
    // Mon-Fri: 06:00-14:30 (8h net), Sat: 09:00-13:30 (4h net)
    buildShifts: (base) => [
      makeShift(base, 0, '06:00', '14:30', 30, 0),
      makeShift(base, 1, '06:00', '14:30', 30, 0),
      makeShift(base, 2, '06:00', '14:30', 30, 0),
      makeShift(base, 3, '06:00', '14:30', 30, 0),
      makeShift(base, 4, '06:00', '14:30', 30, 0),
      makeShift(base, 5, '09:00', '13:30', 30, 0, true),
    ],
    paystub: (base) => ({
      employer_name: "Rosita's Kitchen",
      pay_period_start: fmtDate(base, 0),
      pay_period_end: fmtDate(base, 5),
      hours_paid: 40,
      overtime_hours_paid: 0,
      hourly_rate: 15.00,
      overtime_rate: 0,
      gross_pay: 600.00,
      deductions: [
        { name: 'Federal Tax', amount: 48.00 },
        { name: 'Social Security', amount: 37.20 },
        { name: 'Medicare', amount: 8.70 },
      ],
      tips_reported: 0,
      net_pay: 506.10,
    }),
  },
  {
    id: 'james',
    name: 'James, 22',
    role: 'Construction laborer in Los Angeles, CA',
    industry: 'Construction',
    stubImage: '/demo/paystub-james.svg',
    summary: '48 hours over 5 days. Each 10-hour day triggers 2h of CA daily overtime.',
    tagline: '$216 stolen this pay period',
    stateCode: 'CA',
    city: 'Los Angeles',
    // Mon-Thu: 06:00-16:30 (10h net), Fri: 06:00-14:30 (8h net)
    buildShifts: (base) => [
      makeShift(base, 0, '06:00', '16:30', 30, 0),
      makeShift(base, 1, '06:00', '16:30', 30, 0),
      makeShift(base, 2, '06:00', '16:30', 30, 0, true),
      makeShift(base, 3, '06:00', '16:30', 30, 0),
      makeShift(base, 4, '06:00', '14:30', 30, 0),
    ],
    paystub: (base) => ({
      employer_name: 'Pacific Build Co.',
      pay_period_start: fmtDate(base, 0),
      pay_period_end: fmtDate(base, 4),
      hours_paid: 40,
      overtime_hours_paid: 0,
      hourly_rate: 18.00,
      overtime_rate: 0,
      gross_pay: 720.00,
      deductions: [
        { name: 'Federal Tax', amount: 72.00 },
        { name: 'CA State Tax', amount: 28.80 },
        { name: 'Social Security', amount: 44.64 },
        { name: 'Medicare', amount: 10.44 },
      ],
      tips_reported: 0,
      net_pay: 564.12,
    }),
  },
  {
    id: 'priya',
    name: 'Priya, 47',
    role: 'Home health aide in New York City',
    industry: 'Healthcare',
    stubImage: '/demo/paystub-priya.svg',
    summary: '48 hours over 6 days at $16.50/hr. Paid for 40 hours flat. 8 hours of unpaid overtime.',
    tagline: '$198 stolen this pay period',
    stateCode: 'NY',
    city: 'New York City',
    // Mon-Fri: 07:00-15:30 (8h net), Sat: 08:00-16:30 (8h net)
    buildShifts: (base) => [
      makeShift(base, 0, '07:00', '15:30', 30, 0),
      makeShift(base, 1, '07:00', '15:30', 30, 0),
      makeShift(base, 2, '07:00', '15:30', 30, 0),
      makeShift(base, 3, '07:00', '15:30', 30, 0),
      makeShift(base, 4, '07:00', '15:30', 30, 0),
      makeShift(base, 5, '08:00', '16:30', 30, 0, true),
    ],
    paystub: (base) => ({
      employer_name: 'Sunrise Home Care LLC',
      pay_period_start: fmtDate(base, 0),
      pay_period_end: fmtDate(base, 5),
      hours_paid: 40,
      overtime_hours_paid: 0,
      hourly_rate: 16.50,
      overtime_rate: 0,
      gross_pay: 660.00,
      deductions: [
        { name: 'Federal Tax', amount: 59.40 },
        { name: 'NY State Tax', amount: 33.00 },
        { name: 'NYC Tax', amount: 19.80 },
        { name: 'Social Security', amount: 40.92 },
        { name: 'Medicare', amount: 9.57 },
      ],
      tips_reported: 0,
      net_pay: 497.31,
    }),
  },
]

export function loadScenario(scenarioId) {
  const scenario = DEMO_SCENARIOS.find(s => s.id === scenarioId)
  if (!scenario) return false

  clearAll()

  const base = getLastMonday()
  const shifts = scenario.buildShifts(base)
  const paystub = scenario.paystub(base)

  saveShifts(shifts)
  savePaystub(paystub)
  savePaystubImage(scenario.stubImage)
  saveUserState(scenario.stateCode)
  saveUserCity(scenario.city)

  return true
}

function getLastMonday() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  const day = d.getDay()
  const diff = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function makeShift(base, dayOffset, clockIn, clockOut, breakMinutes, tips, flaggedOT = false) {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  return {
    id: crypto.randomUUID(),
    date: d.toISOString().slice(0, 10),
    clockIn,
    clockOut,
    breakMinutes,
    tips,
    flaggedOT,
  }
}

function fmtDate(base, dayOffset) {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  return d.toISOString().slice(0, 10)
}
