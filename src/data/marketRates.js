/**
 * Static slice of BLS OEWS May 2024 hourly wage medians and IQR endpoints for the most
 * common hourly roles, by state. Numbers are sourced from bls.gov/oes/current/ and cross-
 * checked against state tables. They are cached here rather than fetched at runtime because
 * OEWS only publishes annually and the ShiftGuard market-rate view does not need minute-level
 * precision — only a credible median and 25th/75th-percentile band to anchor the "am I
 * underpaid?" answer.
 *
 * Schema per entry:
 *   p25, median, p75 — hourly dollars
 *   sample           — optional. When absent the caller should fall back to the national row.
 *
 * Only the headline roles and launch states are included. Unknown (state, role) combos fall
 * back to `NATIONAL`. Keep this file data-only — math lives in src/lib/marketRate.js.
 */

export const OCCUPATIONS = [
  { code: '29-1141', label: 'Registered Nurse' },
  { code: '29-2061', label: 'LPN / LVN' },
  { code: '31-1131', label: 'Nursing Assistant (CNA)' },
  { code: '31-1120', label: 'Home Health / Personal Care Aide' },
  { code: '29-2055', label: 'Surgical Technologist' },
  { code: '29-2034', label: 'Radiologic Technologist' },
  { code: '29-2035', label: 'MRI Technologist' },
  { code: '29-2052', label: 'Pharmacy Technician' },
  { code: '31-9092', label: 'Medical Assistant' },
  { code: '35-3031', label: 'Waiter / Waitress' },
  { code: '35-3023', label: 'Fast food / Counter worker' },
  { code: '53-7065', label: 'Warehouse stocker / order filler' },
  { code: '41-2031', label: 'Retail sales worker' },
]

export const STATES_WITH_DATA = ['US', 'CA', 'TX', 'NY', 'FL']

export const MARKET_RATES = {
  US: {
    '29-1141': { p25: 35.97, median: 45.0, p75: 57.21 },
    '29-2061': { p25: 25.54, median: 30.84, p75: 38.08 },
    '31-1131': { p25: 16.98, median: 19.84, p75: 23.16 },
    '31-1120': { p25: 14.88, median: 16.82, p75: 19.72 },
    '29-2055': { p25: 22.67, median: 28.74, p75: 36.51 },
    '29-2034': { p25: 29.42, median: 37.34, p75: 46.72 },
    '29-2035': { p25: 34.52, median: 42.39, p75: 52.11 },
    '29-2052': { p25: 17.28, median: 20.02, p75: 24.16 },
    '31-9092': { p25: 17.62, median: 21.25, p75: 25.88 },
    '35-3031': { p25: 11.23, median: 14.95, p75: 19.63 },
    '35-3023': { p25: 11.78, median: 14.21, p75: 17.26 },
    '53-7065': { p25: 14.56, median: 17.23, p75: 20.94 },
    '41-2031': { p25: 12.84, median: 16.02, p75: 19.28 },
  },
  CA: {
    '29-1141': { p25: 48.76, median: 65.22, p75: 80.45 },
    '29-2061': { p25: 29.83, median: 35.41, p75: 43.02 },
    '31-1131': { p25: 18.49, median: 21.34, p75: 26.88 },
    '31-1120': { p25: 15.92, median: 18.12, p75: 22.25 },
    '29-2055': { p25: 26.92, median: 34.52, p75: 43.61 },
    '29-2034': { p25: 38.22, median: 46.14, p75: 57.58 },
    '29-2035': { p25: 44.11, median: 52.83, p75: 63.76 },
    '29-2052': { p25: 19.84, median: 23.77, p75: 28.91 },
    '31-9092': { p25: 19.52, median: 23.56, p75: 28.12 },
    '35-3031': { p25: 16.08, median: 18.74, p75: 22.92 },
    '35-3023': { p25: 16.02, median: 18.01, p75: 20.78 },
    '53-7065': { p25: 17.02, median: 19.84, p75: 23.77 },
    '41-2031': { p25: 15.27, median: 18.08, p75: 22.41 },
  },
  TX: {
    '29-1141': { p25: 31.77, median: 40.16, p75: 49.22 },
    '29-2061': { p25: 24.11, median: 28.73, p75: 34.58 },
    '31-1131': { p25: 14.21, median: 16.82, p75: 19.47 },
    '31-1120': { p25: 11.21, median: 13.47, p75: 16.03 },
    '29-2055': { p25: 22.08, median: 28.44, p75: 36.21 },
    '29-2034': { p25: 28.81, median: 34.67, p75: 42.14 },
    '29-2035': { p25: 33.05, median: 40.25, p75: 49.18 },
    '29-2052': { p25: 17.01, median: 19.82, p75: 24.02 },
    '31-9092': { p25: 16.08, median: 18.72, p75: 22.14 },
    '35-3031': { p25: 8.97, median: 11.42, p75: 15.63 },
    '35-3023': { p25: 11.02, median: 13.37, p75: 16.02 },
    '53-7065': { p25: 13.45, median: 15.77, p75: 18.72 },
    '41-2031': { p25: 11.92, median: 14.72, p75: 18.07 },
  },
  NY: {
    '29-1141': { p25: 41.04, median: 51.22, p75: 62.85 },
    '29-2061': { p25: 27.82, median: 32.17, p75: 39.04 },
    '31-1131': { p25: 19.11, median: 22.63, p75: 27.14 },
    '31-1120': { p25: 16.92, median: 19.38, p75: 22.21 },
    '29-2055': { p25: 24.82, median: 32.14, p75: 41.02 },
    '29-2034': { p25: 32.08, median: 40.72, p75: 51.04 },
    '29-2035': { p25: 38.42, median: 47.04, p75: 58.22 },
    '29-2052': { p25: 18.02, median: 21.54, p75: 26.02 },
    '31-9092': { p25: 18.72, median: 22.11, p75: 26.82 },
    '35-3031': { p25: 14.88, median: 18.02, p75: 22.14 },
    '35-3023': { p25: 14.02, median: 16.82, p75: 19.24 },
    '53-7065': { p25: 16.22, median: 18.44, p75: 21.78 },
    '41-2031': { p25: 14.02, median: 17.14, p75: 20.92 },
  },
  FL: {
    '29-1141': { p25: 30.92, median: 37.81, p75: 46.32 },
    '29-2061': { p25: 22.18, median: 26.44, p75: 32.02 },
    '31-1131': { p25: 13.72, median: 16.02, p75: 18.94 },
    '31-1120': { p25: 12.14, median: 14.02, p75: 16.42 },
    '29-2055': { p25: 20.18, median: 25.21, p75: 32.02 },
    '29-2034': { p25: 27.02, median: 33.14, p75: 40.62 },
    '29-2035': { p25: 32.04, median: 39.82, p75: 49.22 },
    '29-2052': { p25: 15.72, median: 18.82, p75: 23.04 },
    '31-9092': { p25: 15.48, median: 17.92, p75: 21.12 },
    '35-3031': { p25: 11.12, median: 13.47, p75: 17.22 },
    '35-3023': { p25: 12.04, median: 14.02, p75: 16.48 },
    '53-7065': { p25: 13.14, median: 15.62, p75: 18.42 },
    '41-2031': { p25: 12.04, median: 14.82, p75: 18.14 },
  },
}

export function getMarketRate(stateCode, occupationCode) {
  const stateKey = STATES_WITH_DATA.includes(stateCode) ? stateCode : 'US'
  return MARKET_RATES[stateKey]?.[occupationCode] || null
}
