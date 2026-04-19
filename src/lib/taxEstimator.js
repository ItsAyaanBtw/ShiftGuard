/**
 * Rough paycheck take-home estimator. Federal brackets are 2025 IRS values; FICA is static;
 * state income tax uses a flat approximation per state (nothing fancier is honest at this
 * fidelity). Output is intentionally labeled "estimate" everywhere the UI surfaces it.
 *
 * Not tax advice. We say this loudly wherever the result is shown.
 *
 * Usage:
 *   estimateTakeHome({
 *     grossThisCheck: 2800,
 *     hoursThisCheck: 60,
 *     annualizeOver: 'biweekly', // so we project this check to yearly before bracket lookup
 *     stateCode: 'TX',
 *     filingStatus: 'single',
 *     dependents: 0,
 *   })
 */

// Annual federal income-tax brackets for 2025.
// Source: IRS Rev. Proc. 2024-40 (published Oct 2024) which set 2025 tax-year inflation adjustments.
const FED_BRACKETS_2025 = {
  single: [
    { upTo: 11925,   rate: 0.10 },
    { upTo: 48475,   rate: 0.12 },
    { upTo: 103350,  rate: 0.22 },
    { upTo: 197300,  rate: 0.24 },
    { upTo: 250525,  rate: 0.32 },
    { upTo: 626350,  rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married: [
    { upTo: 23850,   rate: 0.10 },
    { upTo: 96950,   rate: 0.12 },
    { upTo: 206700,  rate: 0.22 },
    { upTo: 394600,  rate: 0.24 },
    { upTo: 501050,  rate: 0.32 },
    { upTo: 751600,  rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  hoh: [
    { upTo: 17000,   rate: 0.10 },
    { upTo: 64850,   rate: 0.12 },
    { upTo: 103350,  rate: 0.22 },
    { upTo: 197300,  rate: 0.24 },
    { upTo: 250525,  rate: 0.32 },
    { upTo: 626350,  rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
}

// 2025 standard deduction.
const STD_DEDUCTION_2025 = { single: 15000, married: 30000, hoh: 22500 }

// Approximate effective state income tax rates for hourly workers. Where a state has
// progressive brackets, we use the marginal rate typical for the $30K–$90K band. These
// are intentionally conservative averages meant for planning, not filing.
// Sources cross-referenced with state revenue department rate tables (FY 2025 rates).
const STATE_FLAT_APPROX = {
  AL: 0.04, AK: 0, AZ: 0.025, AR: 0.044, CA: 0.06, CO: 0.044, CT: 0.055,
  DE: 0.055, DC: 0.065, FL: 0, GA: 0.0539, HI: 0.064, IA: 0.044, ID: 0.058,
  IL: 0.0495, IN: 0.0305, KS: 0.0525, KY: 0.04, LA: 0.0425, MA: 0.05, MD: 0.0475,
  ME: 0.0715, MI: 0.0425, MN: 0.068, MO: 0.047, MS: 0.044, MT: 0.047, NC: 0.044,
  ND: 0.019, NE: 0.052, NH: 0, NJ: 0.0637, NM: 0.049, NV: 0, NY: 0.055,
  OH: 0.0275, OK: 0.0475, OR: 0.0875, PA: 0.0307, RI: 0.0475, SC: 0.0625,
  SD: 0, TN: 0, TX: 0, UT: 0.0455, VA: 0.0575, VT: 0.066,
  WA: 0, WV: 0.05, WI: 0.053, WY: 0,
}

const FICA = {
  socialSecurityRate: 0.062,
  socialSecurityWageBase: 176_100,   // 2025 SSA base
  medicareRate: 0.0145,
  medicareAdditionalRate: 0.009,
  medicareAdditionalThreshold: { single: 200_000, married: 250_000, hoh: 200_000 },
}

const FREQ_PERIODS = {
  weekly: 52,
  biweekly: 26,
  semimonthly: 24,
  monthly: 12,
}

function normStatus(s) {
  const k = String(s || '').toLowerCase()
  if (k === 'married' || k === 'mfj' || k === 'joint') return 'married'
  if (k === 'hoh' || k === 'head' || k === 'headofhousehold') return 'hoh'
  return 'single'
}

function annualTaxFromBrackets(taxableIncome, brackets) {
  let owed = 0
  let lastCap = 0
  for (const b of brackets) {
    if (taxableIncome <= b.upTo) {
      owed += (taxableIncome - lastCap) * b.rate
      return Math.max(0, owed)
    }
    owed += (b.upTo - lastCap) * b.rate
    lastCap = b.upTo
  }
  return Math.max(0, owed)
}

export function estimateTakeHome({
  grossThisCheck,
  hoursThisCheck = 0,
  annualizeOver = 'biweekly',
  stateCode = 'US',
  filingStatus = 'single',
  dependents = 0,
}) {
  const gross = Math.max(0, Number(grossThisCheck) || 0)
  if (gross === 0) return emptyResult(gross, hoursThisCheck)

  const status = normStatus(filingStatus)
  const periods = FREQ_PERIODS[annualizeOver] || FREQ_PERIODS.biweekly
  const annualGross = gross * periods
  const stdDed = STD_DEDUCTION_2025[status] || STD_DEDUCTION_2025.single
  const dependentCredit = Math.max(0, Number(dependents) || 0) * 2000

  const taxableIncome = Math.max(0, annualGross - stdDed)
  const fedBrackets = FED_BRACKETS_2025[status] || FED_BRACKETS_2025.single
  const annualFed = Math.max(0, annualTaxFromBrackets(taxableIncome, fedBrackets) - dependentCredit)
  const fedThisCheck = annualFed / periods

  const ssCap = FICA.socialSecurityWageBase
  const ssTaxableAnnual = Math.min(annualGross, ssCap)
  const annualSS = ssTaxableAnnual * FICA.socialSecurityRate
  const ssThisCheck = annualSS / periods

  const medThreshold = FICA.medicareAdditionalThreshold[status] || FICA.medicareAdditionalThreshold.single
  const annualMed =
    annualGross * FICA.medicareRate +
    Math.max(0, annualGross - medThreshold) * FICA.medicareAdditionalRate
  const medThisCheck = annualMed / periods

  const stateRate = STATE_FLAT_APPROX[stateCode] ?? 0
  const stateThisCheck = taxableIncome > 0 ? ((taxableIncome * stateRate) / periods) : 0

  const totalTax = fedThisCheck + ssThisCheck + medThisCheck + stateThisCheck
  const netThisCheck = Math.max(0, gross - totalTax)

  const marginalRate = pickMarginalRate(taxableIncome, fedBrackets)

  return {
    gross,
    hoursThisCheck,
    annualGrossEstimate: Math.round(annualGross),
    taxableIncome: Math.round(taxableIncome),
    periodsPerYear: periods,
    federal: round(fedThisCheck),
    socialSecurity: round(ssThisCheck),
    medicare: round(medThisCheck),
    stateTax: round(stateThisCheck),
    stateRate,
    totalTax: round(totalTax),
    net: round(netThisCheck),
    effectiveRate: gross > 0 ? Number((totalTax / gross).toFixed(3)) : 0,
    marginalFederalRate: marginalRate,
  }
}

function emptyResult(gross, hoursThisCheck) {
  return {
    gross: gross || 0, hoursThisCheck,
    annualGrossEstimate: 0, taxableIncome: 0,
    periodsPerYear: FREQ_PERIODS.biweekly,
    federal: 0, socialSecurity: 0, medicare: 0, stateTax: 0, stateRate: 0,
    totalTax: 0, net: 0, effectiveRate: 0, marginalFederalRate: 0,
  }
}

function pickMarginalRate(taxableIncome, brackets) {
  for (const b of brackets) if (taxableIncome <= b.upTo) return b.rate
  return 0.37
}

function round(n) { return Math.round(Number(n) * 100) / 100 }
