/**
 * Wage-theft ROI anchor figures. Cite everywhere we ask users for money so the subscription
 * costs less than the problem it solves.
 *
 * Sources:
 *  - EPI (Cooper & Kroeger, 2017): in the 10 most populous states, 2.4M workers lost
 *    ~$8B/year in minimum-wage violations alone; avg affected worker loses ~$3,300/year
 *    (~24% of earnings). https://www.epi.org/publication/employers-steal-billions/
 *  - EPI total wage theft (all categories): ~$15B/year minimum-wage baseline, up to $50B/year
 *    across all wage and hour violations.
 *  - DOL WHD FY 2024 annual data: 80% of investigated residential care and nursing facilities
 *    had federal wage-law violations. https://www.dol.gov/agencies/whd/data
 *  - Bernhardt et al., "Broken Laws" (2009): 68% of low-wage workers experienced at least
 *    one pay violation in a given work week; 76% of OT-eligible who worked OT were paid
 *    less than the legal rate.
 */

export const WAGE_THEFT_ROI = {
  avgAnnualLossPerAffectedWorkerUSD: 3300,
  epiMinWageViolationsUSDPerYear: 15_000_000_000,
  epiTotalWageTheftUSDPerYear: 50_000_000_000,
  healthcareFacilityViolationRatePct: 80,
  lowWageWorkerWeeklyViolationRatePct: 68,
  otEligibleUnderpaidPct: 76,
  sources: {
    epiMinWage: 'https://www.epi.org/publication/employers-steal-billions/',
    dolWhdFY2024: 'https://www.dol.gov/agencies/whd/data',
    bernhardtBrokenLaws: 'https://www.nelp.org/publication/broken-laws-unprotected-workers-violations-of-employment-and-labor-laws-in-americas-cities/',
  },
}

/**
 * How many dollars a subscription recovers for every dollar spent, if the tool catches a
 * single average error per year. Used as the anchor on paywalls.
 * Defaults to ShiftGuard's Pro price so we have one source of truth for the "$X pays for
 * itself N times over" copy.
 */
export const PRO_MONTHLY_USD = 7.99
export const PRO_ANNUAL_USD = 69
export const DEEP_AUDIT_ONE_TIME_USD = 14.99

export function proMonthlyRoiMultiple({ proMonthlyUSD = PRO_MONTHLY_USD } = {}) {
  return Math.round(WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD / (proMonthlyUSD * 12))
}

export function proAnnualRoiMultiple({ proAnnualUSD = PRO_ANNUAL_USD } = {}) {
  return Math.round(WAGE_THEFT_ROI.avgAnnualLossPerAffectedWorkerUSD / proAnnualUSD)
}
