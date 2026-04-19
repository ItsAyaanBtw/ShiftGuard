import { GSA_STANDARD_RATE, findGsaMetro, weeklyTaxFreeCeiling } from '../data/gsaRates'

/**
 * Travel nurse blended-rate X-ray.
 *
 * Agencies advertise a single "blended hourly rate" that combines taxable wages with
 * non-taxable per-diem stipends. The IRS only treats stipends as tax-free if the worker
 * has a legitimate tax home separate from the assignment city (IRS Publication 463) AND
 * the stipend portion does not exceed GSA per-diem caps for the assignment locality.
 *
 * This function:
 *   1. Normalizes the package to a taxable hourly rate and a weekly stipend.
 *   2. Compares the stipend against the GSA ceiling for the assignment locality.
 *   3. Flags the two most common risks: (a) stipend exceeds GSA cap (IRS recharacterization
 *      risk), (b) taxable rate is so low it looks like a wage-recharacterization scheme.
 *
 * All output is informational. This is not tax advice.
 */

export function analyzeTravelPackage({
  weeklyGrossUSD,
  hoursPerWeek = 36,
  taxableHourlyRate = 0,
  weeklyLodgingStipendUSD = 0,
  weeklyMieStipendUSD = 0,
  metroSlug = '',
  hasTaxHome = true,
  weeksOnAssignment = 13,
}) {
  const gross = Math.max(0, Number(weeklyGrossUSD) || 0)
  const hours = Math.max(1, Number(hoursPerWeek) || 36)
  const taxable = Math.max(0, Number(taxableHourlyRate) || 0)
  const lodging = Math.max(0, Number(weeklyLodgingStipendUSD) || 0)
  const mie = Math.max(0, Number(weeklyMieStipendUSD) || 0)
  const weeks = Math.max(1, Number(weeksOnAssignment) || 13)

  const weeklyStipend = lodging + mie
  const weeklyTaxableWages = taxable * hours
  const advertisedBlendedRate = gross / hours

  let taxableShareOfGrossPct = null
  if (gross > 0) {
    taxableShareOfGrossPct = Math.round((weeklyTaxableWages / gross) * 100)
  }

  const metro = findGsaMetro(metroSlug) || GSA_STANDARD_RATE
  const ceiling = weeklyTaxFreeCeiling(metro)
  const stipendOverCapUSD = Math.max(0, weeklyStipend - ceiling)
  const stipendOverCapPct = ceiling > 0 ? Math.round((stipendOverCapUSD / ceiling) * 100) : 0

  const flags = []

  if (!hasTaxHome) {
    flags.push({
      severity: 'high',
      title: 'Stipends may be fully taxable without a valid tax home',
      detail:
        'IRS Publication 463 requires you to maintain a permanent residence elsewhere with ongoing living expenses. If you are not "duplicating expenses," per-diem stipends can be reclassified as taxable wages.',
    })
  }

  if (stipendOverCapUSD > 0) {
    flags.push({
      severity: 'high',
      title: `Weekly stipend exceeds the GSA per-diem cap for ${metro.name}`,
      detail:
        `Your stipend of $${round(weeklyStipend)} is ${stipendOverCapPct}% above the GSA ceiling of $${round(ceiling)}/week. The excess can be reclassified as taxable wages in an IRS audit.`,
    })
  }

  if (taxable > 0 && taxable < 20) {
    flags.push({
      severity: 'medium',
      title: `Taxable hourly rate of $${round(taxable)} is unusually low`,
      detail:
        'A very low taxable rate with high stipends is a pattern the IRS watches for. Confirm the breakdown is defensible and that overtime and PTO calculate on the taxable rate alone (which they usually do).',
    })
  }

  if (taxableShareOfGrossPct != null && taxableShareOfGrossPct < 35) {
    flags.push({
      severity: 'medium',
      title: `Only ${taxableShareOfGrossPct}% of your gross pay is taxable`,
      detail:
        'Industry guidance (travel-nurse-forum norm) is that taxable wages should be at least 35-50% of the blended package to avoid IRS scrutiny.',
    })
  }

  const overtimeBaseRate = taxable
  const monthlyTakeHomeEstimate = gross * 4.33
  const assignmentGrossEstimate = gross * weeks

  return {
    metro,
    advertisedBlendedRate: round(advertisedBlendedRate),
    weeklyTaxableWages: round(weeklyTaxableWages),
    weeklyStipend: round(weeklyStipend),
    weeklyCeiling: round(ceiling),
    stipendOverCapUSD: round(stipendOverCapUSD),
    stipendOverCapPct,
    taxableShareOfGrossPct,
    overtimeBaseRate: round(overtimeBaseRate),
    monthlyTakeHomeEstimate: round(monthlyTakeHomeEstimate),
    assignmentGrossEstimate: round(assignmentGrossEstimate),
    flags,
  }
}

function round(n) { return Math.round(Number(n) * 100) / 100 }
