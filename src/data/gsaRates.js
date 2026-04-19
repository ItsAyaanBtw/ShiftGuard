/**
 * GSA per-diem caps for top US travel-nurse metros (FY 2026 rounded). Source: gsa.gov/travel/
 * plan-book/per-diem-rates. Standard-rate baseline applies anywhere not listed.
 *
 * Lodging is the overnight stay cap. M&IE (meals + incidentals) is the daily food/incidental
 * cap. These two caps together are the maximum per-diem a traveler can be reimbursed
 * tax-free under IRS Publication 463 tax-home rules, assuming they genuinely maintain a
 * permanent residence elsewhere.
 *
 * Schema: { name, state, lodgingPerNight, mieDaily }
 *
 * Keep the list short; callers who don't match an entry fall back to GSA_STANDARD_RATE.
 */

export const GSA_STANDARD_RATE = {
  name: 'Standard (non-listed locality)',
  state: 'US',
  lodgingPerNight: 110,
  mieDaily: 68,
}

export const GSA_TRAVEL_METROS = [
  { slug: 'san_francisco', name: 'San Francisco', state: 'CA', lodgingPerNight: 276, mieDaily: 92 },
  { slug: 'los_angeles',   name: 'Los Angeles',   state: 'CA', lodgingPerNight: 197, mieDaily: 86 },
  { slug: 'san_diego',     name: 'San Diego',     state: 'CA', lodgingPerNight: 194, mieDaily: 86 },
  { slug: 'sacramento',    name: 'Sacramento',    state: 'CA', lodgingPerNight: 164, mieDaily: 80 },
  { slug: 'oakland',       name: 'Oakland',       state: 'CA', lodgingPerNight: 219, mieDaily: 86 },
  { slug: 'new_york_city', name: 'New York City', state: 'NY', lodgingPerNight: 303, mieDaily: 92 },
  { slug: 'boston',        name: 'Boston',        state: 'MA', lodgingPerNight: 264, mieDaily: 92 },
  { slug: 'seattle',       name: 'Seattle',       state: 'WA', lodgingPerNight: 214, mieDaily: 86 },
  { slug: 'portland_or',   name: 'Portland',      state: 'OR', lodgingPerNight: 176, mieDaily: 80 },
  { slug: 'chicago',       name: 'Chicago',       state: 'IL', lodgingPerNight: 207, mieDaily: 86 },
  { slug: 'washington_dc', name: 'Washington DC', state: 'DC', lodgingPerNight: 275, mieDaily: 86 },
  { slug: 'miami',         name: 'Miami',         state: 'FL', lodgingPerNight: 211, mieDaily: 86 },
  { slug: 'tampa',         name: 'Tampa',         state: 'FL', lodgingPerNight: 151, mieDaily: 80 },
  { slug: 'orlando',       name: 'Orlando',       state: 'FL', lodgingPerNight: 155, mieDaily: 80 },
  { slug: 'houston',       name: 'Houston',       state: 'TX', lodgingPerNight: 134, mieDaily: 74 },
  { slug: 'dallas',        name: 'Dallas',        state: 'TX', lodgingPerNight: 155, mieDaily: 80 },
  { slug: 'austin',        name: 'Austin',        state: 'TX', lodgingPerNight: 175, mieDaily: 80 },
  { slug: 'atlanta',       name: 'Atlanta',       state: 'GA', lodgingPerNight: 177, mieDaily: 80 },
  { slug: 'philadelphia',  name: 'Philadelphia',  state: 'PA', lodgingPerNight: 182, mieDaily: 86 },
  { slug: 'denver',        name: 'Denver',        state: 'CO', lodgingPerNight: 190, mieDaily: 80 },
  { slug: 'phoenix',       name: 'Phoenix',       state: 'AZ', lodgingPerNight: 152, mieDaily: 80 },
  { slug: 'minneapolis',   name: 'Minneapolis',   state: 'MN', lodgingPerNight: 160, mieDaily: 80 },
  { slug: 'nashville',     name: 'Nashville',     state: 'TN', lodgingPerNight: 183, mieDaily: 80 },
  { slug: 'honolulu',      name: 'Honolulu',      state: 'HI', lodgingPerNight: 245, mieDaily: 159 },
  { slug: 'anchorage',     name: 'Anchorage',     state: 'AK', lodgingPerNight: 201, mieDaily: 124 },
]

export function findGsaMetro(slug) {
  return GSA_TRAVEL_METROS.find(m => m.slug === slug) || null
}

/**
 * Monthly per-diem ceiling for a 4-week assignment (28 days lodging, 20 working days M&IE).
 * GSA typically allows 100% of M&IE on travel days and 75% on first/last days; we simplify to
 * 7 × lodging/week and 5 × M&IE/week because travel nurses work 3–5 days/week on assignment.
 */
export function weeklyTaxFreeCeiling(metro) {
  if (!metro) return 0
  return metro.lodgingPerNight * 7 + metro.mieDaily * 5
}
