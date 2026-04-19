/**
 * State labor law rules for the comparison engine.
 * MVP covers TX, CA, NY, FL (40%+ of U.S. hourly workers).
 * Query by state code: stateLaws['TX'], stateLaws['CA'], etc.
 */
const stateLaws = {
  TX: {
    name: 'Texas',
    code: 'TX',
    minimumWage: {
      state: 7.25,
      federal: 7.25,
      tipped: 2.13,
      localOverrides: {},
    },
    overtime: {
      type: 'weekly',
      weeklyThreshold: 40,
      multiplier: 1.5,
      dailyThreshold: null,
      doubleTimeThreshold: null,
      doubleTimeMultiplier: null,
    },
    tipCredit: {
      allowed: true,
      maxCredit: 5.12,
      minimumCashWage: 2.13,
    },
    breaks: {
      mealRequired: false,
      mealThresholdHours: null,
      mealDurationMinutes: null,
      restRequired: false,
      restPerHours: null,
      restDurationMinutes: null,
      penaltyPerViolation: null,
    },
    complaintAgency: {
      name: 'Texas Workforce Commission (TWC)',
      url: 'https://www.twc.texas.gov/jobseekers/how-submit-wage-claim-under-texas-payday-law',
      formName: 'Wage Claim Form',
    },
    statutes: {
      overtime: 'FLSA Section 7(a)',
      minimumWage: 'FLSA Section 6; Texas Payday Law',
      payday: 'Texas Payday Law, Tex. Lab. Code Ch. 61',
    },
    notes: 'No state minimum wage above federal. No state meal or rest break requirements.',
  },

  CA: {
    name: 'California',
    code: 'CA',
    minimumWage: {
      state: 16.50,
      federal: 7.25,
      tipped: 16.50,
      localOverrides: {
        'Los Angeles': 16.90,
        'San Francisco': 18.67,
        'San Jose': 17.55,
      },
    },
    overtime: {
      type: 'daily_and_weekly',
      weeklyThreshold: 40,
      multiplier: 1.5,
      dailyThreshold: 8,
      doubleTimeThreshold: 12,
      doubleTimeMultiplier: 2.0,
    },
    tipCredit: {
      allowed: false,
      maxCredit: 0,
      minimumCashWage: 16.50,
    },
    breaks: {
      mealRequired: true,
      mealThresholdHours: 5,
      mealDurationMinutes: 30,
      restRequired: true,
      restPerHours: 4,
      restDurationMinutes: 10,
      penaltyPerViolation: 'one_hour_pay',
    },
    complaintAgency: {
      name: 'CA Division of Labor Standards Enforcement (DLSE)',
      url: 'https://www.dir.ca.gov/dlse/howtofilewageclaim.htm',
      formName: 'Initial Report or Claim (Form DLSE-1)',
    },
    statutes: {
      overtime: 'Cal. Lab. Code § 510; IWC Wage Orders',
      minimumWage: 'Cal. Lab. Code § 1182.12',
      breaks: 'Cal. Lab. Code §§ 226.7, 512',
      payday: 'Cal. Lab. Code §§ 201-204',
    },
    notes:
      'Daily overtime at 8+ hours (1.5x), double time at 12+ hours (2x). ' +
      'No tip credit allowed. Meal break required for 5+ hour shifts. ' +
      'Rest break: 10 min per 4 hours worked.',
  },

  NY: {
    name: 'New York',
    code: 'NY',
    minimumWage: {
      state: 15.00,
      federal: 7.25,
      tipped: 10.00,
      localOverrides: {
        'New York City': 16.50,
        'Long Island': 16.50,
        'Westchester': 16.50,
      },
    },
    overtime: {
      type: 'weekly',
      weeklyThreshold: 40,
      multiplier: 1.5,
      dailyThreshold: null,
      doubleTimeThreshold: null,
      doubleTimeMultiplier: null,
    },
    tipCredit: {
      allowed: true,
      maxCredit: 6.50,
      minimumCashWage: 10.00,
    },
    breaks: {
      mealRequired: true,
      mealThresholdHours: 6,
      mealDurationMinutes: 30,
      restRequired: false,
      restPerHours: null,
      restDurationMinutes: null,
      penaltyPerViolation: null,
    },
    complaintAgency: {
      name: 'NY Department of Labor',
      url: 'https://dol.ny.gov/unpaidwithheld-wages-and-wage-supplements',
      formName: 'Labor Standards Complaint Form (LS 223)',
    },
    statutes: {
      overtime: 'FLSA Section 7(a); 12 NYCRR Part 142',
      minimumWage: 'NY Lab. Law § 652',
      payday: 'NY Lab. Law § 191',
      wageTheftAct: 'NY Wage Theft Prevention Act',
    },
    notes:
      'Wage theft classified as larceny under NY Penal Law. ' +
      'Strong anti-retaliation protections. ' +
      'NYC, Long Island, and Westchester have higher minimum wage ($16.50).',
  },

  FL: {
    name: 'Florida',
    code: 'FL',
    minimumWage: {
      state: 14.00,
      federal: 7.25,
      tipped: 10.98,
      localOverrides: {},
    },
    overtime: {
      type: 'weekly',
      weeklyThreshold: 40,
      multiplier: 1.5,
      dailyThreshold: null,
      doubleTimeThreshold: null,
      doubleTimeMultiplier: null,
    },
    tipCredit: {
      allowed: true,
      maxCredit: 3.02,
      minimumCashWage: 10.98,
    },
    breaks: {
      mealRequired: false,
      mealThresholdHours: null,
      mealDurationMinutes: null,
      restRequired: false,
      restPerHours: null,
      restDurationMinutes: null,
      penaltyPerViolation: null,
    },
    complaintAgency: {
      name: 'Florida Department of Economic Opportunity',
      url: 'https://floridajobs.org/workplace-laws',
      formName: 'Federal WHD Complaint (no state form)',
    },
    statutes: {
      overtime: 'FLSA Section 7(a)',
      minimumWage: 'Fla. Const. Art. X, § 24; Fla. Stat. § 448.110',
      payday: 'FLSA (Florida follows federal law)',
    },
    notes:
      'Minimum wage set by constitutional amendment (increases annually). ' +
      'No state meal or rest break law. Follows federal FLSA for overtime.',
  },
}

export { healthcarePayRules } from './healthcarePayRules'
export default stateLaws

/**
 * Get the effective minimum wage for a state, optionally for a specific city.
 */
export function getMinimumWage(stateCode, city = null) {
  const state = stateLaws[stateCode]
  if (!state) return null

  if (city && state.minimumWage.localOverrides[city]) {
    return state.minimumWage.localOverrides[city]
  }

  return Math.max(state.minimumWage.state, state.minimumWage.federal)
}

/**
 * Get the overtime rules for a given state.
 */
export function getOvertimeRules(stateCode) {
  const state = stateLaws[stateCode]
  if (!state) return null
  return state.overtime
}
