import {
  saveShifts,
  savePaystub,
  savePaystubImage,
  saveUserState,
  saveUserCity,
  clearAll,
  saveUserPreferences,
  saveTimesheetRecord,
} from './storage'
import { reconcileShifts } from './timesheetReconcile'

/**
 * Demo scenarios. Fictional employers, fictional people, real pay math.
 *
 * Scenarios are aligned to the four personas in the ShiftGuard master document:
 *   - Sarah: ICU nurse in Austin, TX. The canonical pitch demo. Hits ~$252 owed.
 *   - Marcus: Amazon-style warehouse associate in Dallas, TX. Night diff + weekly OT story.
 *   - Destiny: CNA in a Florida long-term care facility. Time-clock rounding story.
 *   - Maria: Restaurant server in Austin, TX. Weekly OT + simple tip math.
 *
 * Each scenario bakes in a pre-matched timesheet (Kronos-style) so demos ship pre-verified,
 * with one shift intentionally off by 5-6 minutes so judges see the "off by a bit" state.
 */
export const DEMO_SCENARIOS = [
  {
    id: 'sarah',
    name: 'Sarah, 29',
    role: 'Night-shift ICU nurse in Austin, TX',
    industry: 'Healthcare',
    industryKey: 'healthcare',
    stubImage: '/demo/paystub-sarah.svg',
    summary:
      'Three 12-hour nights, one Saturday, one Memorial Day holiday shift. Base and OT look right on the stub; night, weekend, and holiday premiums were not applied.',
    tagline: 'About $252 in premiums to verify this period',
    stateCode: 'TX',
    city: null,
    buildShifts: (base) => [
      makeShift(base, 0, '19:00', '07:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 1, '19:00', '07:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 2, '19:00', '07:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 5, '07:00', '19:30', 30, 0, false, { shiftType: 'day', isWeekend: true }),
      makeShift(base, 6, '07:00', '19:30', 30, 0, false, { shiftType: 'day', isHoliday: true }),
    ],
    paystub: (base) => ({
      employer_name: "St. David's Medical Center",
      pay_period_start: fmtDate(base, 0),
      pay_period_end: fmtDate(base, 6),
      hours_paid: 40,
      overtime_hours_paid: 20,
      hourly_rate: 42.0,
      overtime_rate: 63.0,
      gross_pay: 2940.0,
      deductions: [
        { name: 'Federal Tax', amount: 441.0 },
        { name: 'Social Security', amount: 182.28 },
        { name: 'Medicare', amount: 42.63 },
      ],
      tips_reported: 0,
      net_pay: 2274.09,
    }),
    prefs: {
      industryMode: 'healthcare',
      healthcareMode: true,
      nightDiff: 3,
      weekendDiff: 4,
      holidayPremiumPerHour: 8,
      industry: 'healthcare',
      paySituation: 'multi_rate',
      occupationCode: '29-1141',
      payFrequency: 'biweekly',
      filingStatus: 'single',
    },
  },
  {
    id: 'marcus',
    name: 'Marcus, 27',
    role: 'Warehouse associate in Dallas, TX',
    industry: 'Warehouse',
    industryKey: 'warehouse',
    stubImage: '/demo/paystub-marcus.svg',
    summary:
      'Forty-eight hours across six days on the overnight dock. Eight hours of overtime are on the stub, but the $1/hr night differential was only applied to part of the week.',
    tagline: 'About $40 in night differential to verify',
    stateCode: 'TX',
    city: null,
    buildShifts: (base) => [
      makeShift(base, 0, '22:00', '06:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 1, '22:00', '06:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 2, '22:00', '06:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 3, '22:00', '06:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 4, '22:00', '06:30', 30, 0, false, { shiftType: 'night' }),
      makeShift(base, 5, '22:00', '06:30', 30, 0, true, { shiftType: 'night', isWeekend: true }),
    ],
    paystub: (base) => ({
      employer_name: 'Northstar Fulfillment LLC',
      pay_period_start: fmtDate(base, 0),
      pay_period_end: fmtDate(base, 5),
      hours_paid: 40,
      overtime_hours_paid: 8,
      hourly_rate: 19.0,
      overtime_rate: 28.5,
      gross_pay: 988.0,
      deductions: [
        { name: 'Federal Tax', amount: 98.8 },
        { name: 'Social Security', amount: 61.26 },
        { name: 'Medicare', amount: 14.33 },
        { name: 'Medical Premium', amount: 42.0 },
      ],
      tips_reported: 0,
      net_pay: 771.61,
    }),
    prefs: {
      industryMode: 'warehouse',
      healthcareMode: false,
      nightDiff: 1,
      weekendDiff: 0,
      holidayPremiumPerHour: null,
      industry: 'warehouse',
      paySituation: 'multi_rate',
      occupationCode: '53-7065',
      payFrequency: 'weekly',
      filingStatus: 'single',
    },
  },
  {
    id: 'destiny',
    name: 'Destiny, 24',
    role: 'CNA at a long-term care facility in Tampa, FL',
    industry: 'Long-term care',
    industryKey: 'longterm_care',
    stubImage: '/demo/paystub-destiny.svg',
    summary:
      'Ten shifts at $15.50/hr. Kronos rounded each clock-in and clock-out to the nearest quarter-hour, which shaves time off every shift and adds up across the pay period.',
    tagline: 'About $18 in rounded-away time to verify',
    stateCode: 'FL',
    city: null,
    buildShifts: (base) => buildDestinyShifts(base),
    paystub: (base) => ({
      employer_name: 'Cypress Grove Senior Care',
      pay_period_start: fmtDate(base, 0),
      pay_period_end: fmtDate(base, 13),
      hours_paid: 78.83,
      overtime_hours_paid: 0,
      hourly_rate: 15.5,
      overtime_rate: 0,
      gross_pay: 1221.87,
      deductions: [
        { name: 'Federal Tax', amount: 97.74 },
        { name: 'Social Security', amount: 75.75 },
        { name: 'Medicare', amount: 17.72 },
        { name: 'Uniform Deposit', amount: 12.0 },
      ],
      tips_reported: 0,
      net_pay: 1018.66,
    }),
    prefs: {
      industryMode: 'healthcare',
      healthcareMode: true,
      nightDiff: 0,
      weekendDiff: 0,
      holidayPremiumPerHour: null,
      industry: 'healthcare',
      paySituation: 'single_rate',
      occupationCode: '31-1131',
      payFrequency: 'biweekly',
      filingStatus: 'single',
    },
  },
  {
    id: 'maria',
    name: 'Maria, 34',
    role: 'Restaurant server in Austin, TX',
    industry: 'Food Service',
    industryKey: 'restaurant',
    stubImage: '/demo/paystub-maria.svg',
    summary: 'Forty-four hours worked, paid for forty. Four hours of overtime premium look missing at $15/hr base.',
    tagline: 'About $30 in overtime premium to verify',
    stateCode: 'TX',
    city: null,
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
      hourly_rate: 15.0,
      overtime_rate: 0,
      gross_pay: 600.0,
      deductions: [
        { name: 'Federal Tax', amount: 48.0 },
        { name: 'Social Security', amount: 37.2 },
        { name: 'Medicare', amount: 8.7 },
      ],
      tips_reported: 0,
      net_pay: 506.1,
    }),
    prefs: {
      industryMode: 'restaurant',
      healthcareMode: false,
      nightDiff: 0,
      weekendDiff: 0,
      holidayPremiumPerHour: null,
      industry: 'restaurant',
      paySituation: 'tipped',
      occupationCode: '35-3031',
      payFrequency: 'weekly',
      filingStatus: 'single',
    },
  },
  {
    id: 'organizer',
    name: 'Tomás, 41',
    role: 'Organizer at SEIU Local 199 · Houston worker center',
    industry: 'Labor union · Worker center',
    industryKey: 'union',
    stubImage: '/demo/paystub-union-member.svg',
    audience: 'b2b',
    organizer: {
      orgName: 'SEIU Local 199',
      orgType: 'Labor union',
      city: 'Houston, TX',
      memberCount: 47,
      flaggedStubs: 12,
      topEmployer: 'Starlight Home Care',
      patternSummary:
        'Across 47 represented home health aides at Starlight, 12 paystubs are short on the 7th-consecutive-day premium written into the 2025-2028 CBA.',
    },
    summary:
      'Your member Luz Herrera, a home health aide at Starlight Home Care, is missing a CBA-guaranteed travel-time pay line this period. Same pattern is showing up across your other 46 members at this employer.',
    tagline: 'Cohort pattern: ~$214 per affected member in missed travel time',
    stateCode: 'TX',
    city: null,
    buildShifts: (base) => [
      makeShift(base, 0, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 1, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 2, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 3, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 4, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 7, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 8, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 9, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
      makeShift(base, 10, '07:30', '17:45', 30, 0, true, { shiftType: 'day' }),
      makeShift(base, 11, '07:30', '15:45', 30, 0, false, { shiftType: 'day' }),
    ],
    paystub: (base) => ({
      employer_name: 'Starlight Home Care',
      pay_period_start: fmtDate(base, 0),
      pay_period_end: fmtDate(base, 13),
      hours_paid: 80,
      overtime_hours_paid: 4,
      hourly_rate: 17.85,
      overtime_rate: 26.78,
      gross_pay: 1535.1,
      deductions: [
        { name: 'Federal Tax', amount: 122.81 },
        { name: 'Social Security', amount: 95.18 },
        { name: 'Medicare', amount: 22.26 },
        { name: 'SEIU Local 199 Dues', amount: 41.0 },
        { name: 'Medical (Union Plan)', amount: 28.0 },
      ],
      tips_reported: 0,
      net_pay: 1225.85,
    }),
    prefs: {
      industryMode: 'healthcare',
      healthcareMode: true,
      nightDiff: 0,
      weekendDiff: 0,
      holidayPremiumPerHour: null,
      industry: 'home_care',
      paySituation: 'multi_rate',
      occupationCode: '31-1121',
      payFrequency: 'biweekly',
      filingStatus: 'single',
      organizerMode: true,
      organizerOrgName: 'SEIU Local 199',
      organizerOrgType: 'Labor union',
      organizerCity: 'Houston, TX',
      organizerMemberCount: 47,
      organizerFlaggedStubs: 12,
      organizerTopEmployer: 'Starlight Home Care',
      organizerPatternSummary:
        'Across 47 represented home health aides at Starlight, 12 paystubs are short on the 7th-consecutive-day premium written into the 2025-2028 CBA.',
    },
  },
]

export function loadScenario(scenarioId) {
  const scenario = DEMO_SCENARIOS.find(s => s.id === scenarioId)
  if (!scenario) return false

  clearAll()

  const base = getLastMonday()
  const shifts = scenario.buildShifts(base)
  const paystub = scenario.paystub(base)

  const department = departmentFor(scenario.id)

  const timesheet = {
    source_label: scenarioTimesheetSource(scenario.id),
    employer_name: paystub.employer_name,
    employee_name: scenario.name.split(',')[0] || '',
    period_start: paystub.pay_period_start,
    period_end: paystub.pay_period_end,
    parse_confidence: 0.97,
    notes: 'Imported from demo scenario.',
    entries: shifts.map((s, i) => ({
      date: s.date,
      in_time: i === shifts.length - 1 ? bumpMinutes(s.clockIn, 6) : s.clockIn,
      out_time: s.clockOut,
      break_minutes: s.breakMinutes,
      department,
      shift_notes: s.shiftType || '',
    })),
  }

  // Tag every shift with the correct employer and department so every downstream
  // surface (Dashboard upcoming shifts, Report, Compare) stays strictly inside the
  // loaded persona's profession.
  const labeledShifts = shifts.map(s => ({
    ...s,
    employer: paystub.employer_name,
    department,
  }))

  const reconciled = reconcileShifts(labeledShifts, timesheet)
  const lastPayDate = fmtDate(base, -1)

  saveShifts(reconciled.shifts)
  saveTimesheetRecord(timesheet)
  savePaystub(paystub)
  savePaystubImage(scenario.stubImage)
  saveUserState(scenario.stateCode)
  saveUserCity(scenario.city)

  saveUserPreferences({
    ...(scenario.prefs || {}),
    lastPayDate,
    subscriptionTier: 'free',
    continuousWageCheck: true,
    // Demo marker: downstream surfaces (ShiftLogger industry pack, Landing
    // industries grid, etc.) collapse to this single scenario's profession
    // so the walkthrough never shows cross-industry chrome.
    demoScenario: scenario.id,
    demoIndustryLabel: scenario.industry,
  })

  return true
}

/** True if the current account has a loaded demo scenario. */
export function isDemoActive(prefs) {
  return !!(prefs && prefs.demoScenario)
}

// Department is scenario-specific, not just industry-specific: Sarah is ICU, Destiny
// is Memory Care, Marcus is Inbound Dock, Maria is FOH. This keeps each persona's
// paperwork consistent across the pay stub, timesheet, and Dashboard.
function departmentFor(scenarioId) {
  switch (scenarioId) {
    case 'sarah':     return 'ICU / Intensive Care'
    case 'marcus':    return 'Inbound Dock, Bldg 4'
    case 'destiny':   return 'Memory Care, Wing B'
    case 'maria':     return 'Front of House'
    case 'organizer': return 'Home Health, Houston South'
    default:          return ''
  }
}

function scenarioTimesheetSource(id) {
  switch (id) {
    case 'sarah':     return 'Kronos Workforce Central · Timecard export'
    case 'marcus':    return 'UKG Dimensions · Badge clock report'
    case 'destiny':   return 'Kronos InTouch terminal · Rounded timecard'
    case 'maria':     return 'Toast POS · Timesheet export'
    case 'organizer': return 'Paycom Timecard · Member-uploaded'
    default:          return 'Employer time record'
  }
}

function buildDestinyShifts(base) {
  // Ten shifts across a two-week period. Clock-in at 06:53 (rounds up to 07:00),
  // clock-out at 15:08 (rounds down to 15:00), costing about 7 minutes per shift.
  const days = [0, 1, 2, 4, 5, 7, 8, 9, 11, 12]
  return days.map(d =>
    makeShift(base, d, '06:53', '15:08', 30, 0, false, { shiftType: 'day' }),
  )
}

function bumpMinutes(hhmm, deltaMin) {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const total = (h * 60 + m + deltaMin + 24 * 60) % (24 * 60)
  const nh = Math.floor(total / 60)
  const nm = total % 60
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`
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

function makeShift(base, dayOffset, clockIn, clockOut, breakMinutes, tips, flaggedOT = false, opts = {}) {
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
    shiftType: opts.shiftType || 'day',
    isWeekend: !!opts.isWeekend,
    isHoliday: !!opts.isHoliday,
    chargeNurse: !!opts.chargeNurse,
    preceptor: !!opts.preceptor,
    onCallHours: Number(opts.onCallHours) || 0,
  }
}

function fmtDate(base, dayOffset) {
  const d = new Date(base)
  d.setDate(d.getDate() + dayOffset)
  return d.toISOString().slice(0, 10)
}
