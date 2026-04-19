/**
 * PTO value calculator. Converts accrued PTO hours and average shift pay into a single
 * dollar number that's easy to react to, plus a use-or-lose warning when an anniversary
 * or cap date is within 90 days.
 *
 * State notes (informational, not tax advice):
 *   - CA: use-it-or-lose-it policies are NOT permitted for vacation PTO once accrued;
 *     employers may cap accrual at a reasonable multiple of annual accrual.
 *   - NY, CO, NE, NV, RI, VA, WY: private-sector vacation policies are largely a matter
 *     of employer contract; check your handbook.
 *   - The warning is informational only — users should confirm against their handbook.
 */

const CA_LIKE_STATES_NO_FORFEIT = new Set(['CA', 'MT', 'NE'])

export function valuePto({
  accruedHours,
  hourlyRate,
  differentialsPerHour = 0,
  anniversaryISO = '',
  capHours = null,
  stateCode = 'US',
  now = new Date(),
}) {
  const hours = Math.max(0, Number(accruedHours) || 0)
  const base = Math.max(0, Number(hourlyRate) || 0)
  const diffs = Math.max(0, Number(differentialsPerHour) || 0)
  const cap = Number.isFinite(Number(capHours)) && Number(capHours) > 0 ? Number(capHours) : null
  const valueUSD = round(hours * (base + diffs))

  let daysToAnniversary = null
  if (anniversaryISO) {
    const annD = new Date(anniversaryISO + 'T00:00:00')
    if (!Number.isNaN(annD.valueOf())) {
      daysToAnniversary = Math.round((annD - now) / (1000 * 60 * 60 * 24))
    }
  }

  const capHeadroomHours = cap != null ? Math.max(0, cap - hours) : null
  const atCapRisk = cap != null && hours >= cap * 0.9

  const forfeitRisk =
    atCapRisk ||
    (daysToAnniversary != null && daysToAnniversary <= 90 && !CA_LIKE_STATES_NO_FORFEIT.has(stateCode))

  return {
    hours,
    valueUSD,
    daysToAnniversary,
    capHeadroomHours,
    atCapRisk,
    forfeitRisk,
    stateForfeitsPermitted: !CA_LIKE_STATES_NO_FORFEIT.has(stateCode),
  }
}

function round(n) { return Math.round(Number(n) * 100) / 100 }
