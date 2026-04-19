import { normalizeAnalysis } from './analysisUtils'

const KEYS = {
  SHIFTS: 'shiftguard_shifts',
  PAYSTUB: 'shiftguard_paystub',
  PAYSTUB_IMAGE: 'shiftguard_paystub_image',
  VIOLATIONS: 'shiftguard_violations',
  STATE: 'shiftguard_state',
  CITY: 'shiftguard_city',
  DOCUMENTS: 'shiftguard_documents',
  PREFS: 'shiftguard_prefs',
  ONBOARDING: 'shiftguard_onboarding',
  VERIFIED_PAYCHECK_KEYS: 'shiftguard_verified_paycheck_keys',
  VERIFICATION_HISTORY: 'shiftguard_verification_history',
  TIMESHEET: 'shiftguard_timesheet',
  VAULT: 'shiftguard_vault',
  ANOMALIES: 'shiftguard_anomalies',
  REMINDERS: 'shiftguard_reminders_dismissed',
}

const DEFAULT_PREFS = {
  healthcareMode: false,
  nightDiff: 3,
  weekendDiff: 4,
  /** Extra $/hr expected on holiday hours (varies by policy). Null = 0.5 × base rate in engine. */
  holidayPremiumPerHour: null,
  chargeNurseDiff: 2,
  preceptorDiff: 1.5,
  /** 'free' | 'pro' — local demo toggle until billing is wired. Premium merged into Pro. */
  subscriptionTier: 'free',
  /** 'monthly' | 'annual' — only meaningful when subscriptionTier != 'free'. */
  billingCadence: 'monthly',
  /** BLS OEWS SOC-style code for market-rate lookups. Common ones: 29-1141 RN, 31-1131 CNA,
   *  29-2061 LPN, 31-1120 HomeHealth, 29-2031 RadTech, 35-3031 Server. */
  occupationCode: '',
  industry: '',
  paySituation: '',
  /** Pay cycle planning. Frequency options: 'weekly' | 'biweekly' | 'semimonthly' | 'monthly'. */
  payFrequency: 'biweekly',
  /** Last pay date the user has actually been paid, as ISO string (YYYY-MM-DD). */
  lastPayDate: '',
  /** Federal filing status for the simple tax estimator. */
  filingStatus: 'single',
  /** Claimed dependents for the tax estimator. */
  dependents: 0,
  /** Re-run the comparison whenever a new stub is saved, and surface anomalies to the banner. */
  continuousWageCheck: true,
  /**
   * Industry pay pack. Controls which extra shift fields show in the logger and which rule
   * helpers run in the comparison engine. 'general' falls back to base + overtime only.
   */
  industryMode: 'general',
  /** Warehouse: per-hour productivity bonus paid when productivity threshold is hit. */
  productivityBonusPerHour: 0,
  /** Restaurant: tip credit basis per hour (e.g., $2.13 federal). */
  tipCreditRate: 0,
  /** Trades: per-diem $/day for days spent away from tax home. */
  perDiemPerDay: 0,
  /** Trades: hazard / fringe differential in $/hr. */
  hazardDiffPerHour: 0,
}

/** Free plan verification cap per calendar month. Updated to 3 per product spec. */
export const FREE_MONTHLY_CHECK_LIMIT = 3

const PAYSTUB_NUMBER_FIELDS = [
  'hours_paid',
  'overtime_hours_paid',
  'hourly_rate',
  'overtime_rate',
  'gross_pay',
  'tips_reported',
  'net_pay',
  'parse_confidence',
]

function notifyDataChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shiftguard-data-changed'))
  }
}

function read(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data))
    notifyDataChanged()
  } catch (err) {
    console.error('[ShiftGuard] Storage write failed (private mode, quota, or blocked).', err)
  }
}

function remove(key) {
  localStorage.removeItem(key)
  notifyDataChanged()
}

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function normalizeDeduction(entry) {
  if (!isRecord(entry)) return null
  return {
    ...entry,
    name: String(entry.name || ''),
    amount: toFiniteNumber(entry.amount),
  }
}

function normalizePaystubRecord(paystub) {
  if (!isRecord(paystub)) return null

  const normalized = { ...paystub }
  for (const field of PAYSTUB_NUMBER_FIELDS) {
    normalized[field] = toFiniteNumber(paystub[field])
  }

  normalized.employer_name = String(paystub.employer_name || '')
  normalized.pay_period_start = String(paystub.pay_period_start || '')
  normalized.pay_period_end = String(paystub.pay_period_end || '')
  normalized.pay_date = paystub.pay_date ? String(paystub.pay_date) : ''
  normalized.state = paystub.state ? String(paystub.state) : ''
  normalized.notes = paystub.notes ? String(paystub.notes) : ''
  normalized.deductions = Array.isArray(paystub.deductions)
    ? paystub.deductions.map(normalizeDeduction).filter(Boolean)
    : []

  return normalized
}

function normalizeVaultEntry(entry, index = 0) {
  if (!isRecord(entry)) return null

  const paystub = normalizePaystubRecord(entry.paystub || entry)
  if (!paystub) return null

  const paystubKey = entry.paystubKey || vaultKeyFor(paystub) || null
  const fallbackId = paystubKey || `stub-${index}`

  return {
    id: String(entry.id || fallbackId),
    paystubKey,
    savedAt: String(entry.savedAt || paystub.pay_date || paystub.pay_period_end || ''),
    paystub,
    imageUrl: typeof entry.imageUrl === 'string' ? entry.imageUrl : null,
  }
}

export function getShifts() {
  const shifts = read(KEYS.SHIFTS)
  return Array.isArray(shifts) ? shifts : []
}

export function saveShifts(shifts) {
  write(KEYS.SHIFTS, shifts)
}

/**
 * Last parsed employer time record (Kronos export, Workday screenshot, posted schedule, etc).
 * Used to mark shifts as employer-verified.
 */
export function getTimesheetRecord() {
  return read(KEYS.TIMESHEET)
}

export function saveTimesheetRecord(record) {
  if (!record) remove(KEYS.TIMESHEET)
  else write(KEYS.TIMESHEET, record)
}

export function getPaystub() {
  return normalizePaystubRecord(read(KEYS.PAYSTUB))
}

export function savePaystub(paystub) {
  const normalized = normalizePaystubRecord(paystub)
  if (!normalized) return
  write(KEYS.PAYSTUB, normalized)
}

export function getPaystubImage() {
  return read(KEYS.PAYSTUB_IMAGE)
}

export function savePaystubImage(url) {
  if (url) write(KEYS.PAYSTUB_IMAGE, url)
  else remove(KEYS.PAYSTUB_IMAGE)
}

export function getViolations() {
  return read(KEYS.VIOLATIONS)
}

function paycheckVerificationKey(paystub) {
  if (!paystub || typeof paystub !== 'object') return null
  const start = paystub.pay_period_start || ''
  const end = paystub.pay_period_end || ''
  const emp = paystub.employer_name || ''
  if (!end) return null
  return `${emp}|${start}|${end}`
}

export function saveViolations(analysis) {
  const paystub = read(KEYS.PAYSTUB)
  const key = paycheckVerificationKey(paystub)
  const tracked = read(KEYS.VERIFIED_PAYCHECK_KEYS) || []
  if (key && !tracked.includes(key)) {
    write(KEYS.VERIFIED_PAYCHECK_KEYS, [...tracked, key])
  }
  write(KEYS.VIOLATIONS, analysis)

  const normalized = normalizeAnalysis(analysis)
  const entry = {
    at: new Date().toISOString(),
    paystubKey: key || 'unknown',
    employer: paystub?.employer_name || '',
    periodStart: paystub?.pay_period_start || '',
    periodEnd: paystub?.pay_period_end || '',
    totalDifference: Number(normalized?.totalDifference) || 0,
    discrepancyCount: normalized?.discrepancies?.length ?? 0,
    hoursWorked: normalized?.summary?.totalHoursWorked ?? 0,
    expectedGross: normalized?.summary?.expectedGross ?? 0,
    actualGross: normalized?.summary?.actualGross ?? 0,
  }
  const hist = read(KEYS.VERIFICATION_HISTORY) || []
  write(KEYS.VERIFICATION_HISTORY, [entry, ...hist].slice(0, 100))
}

/** Newest first. Each compare run appends an event (audit-style). */
export function getVerificationHistory() {
  const history = read(KEYS.VERIFICATION_HISTORY)
  return Array.isArray(history) ? history : []
}

/** Sum of latest totalDifference per distinct pay period (paystubKey). */
export function getCumulativeFlaggedUnique() {
  const hist = getVerificationHistory()
  const latestByKey = new Map()
  for (const e of hist) {
    const k = e.paystubKey || e.at
    if (!latestByKey.has(k)) latestByKey.set(k, e)
  }
  let sum = 0
  for (const e of latestByKey.values()) {
    sum += Number(e.totalDifference) || 0
  }
  return Math.round(sum * 100) / 100
}

/** Compare runs this calendar month (each run counts; used for Free tier messaging). */
export function getVerificationRunCountThisMonth() {
  const hist = getVerificationHistory()
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return hist.filter(e => {
    const d = new Date(e.at)
    return d.getFullYear() === y && d.getMonth() === m
  }).length
}

export function isProPlan() {
  const t = getUserPreferences().subscriptionTier
  return t === 'pro' || t === 'premium'
}

/**
 * Kept as a back-compat alias only. The public product now has a single paid tier (Pro).
 * Any code paths that still call isPremiumPlan() get the same answer as isProPlan().
 */
export function isPremiumPlan() {
  return isProPlan()
}

export function getFreeChecksRemainingThisMonth() {
  return Math.max(0, FREE_MONTHLY_CHECK_LIMIT - getVerificationRunCountThisMonth())
}

/* -------------------------------------------------------------------------- */
/*  Pay-stub vault                                                             */
/* -------------------------------------------------------------------------- */

/**
 * All saved pay stubs, newest first. A vault entry is `{ id, savedAt, paystub, imageUrl? }`.
 * Keep images small (SVG demo assets, compressed user uploads) because localStorage caps at ~5 MB.
 */
export function getPaystubVault() {
  const vault = read(KEYS.VAULT)
  if (!Array.isArray(vault)) return []
  return vault.map(normalizeVaultEntry).filter(Boolean)
}

function vaultKeyFor(paystub) {
  if (!paystub || typeof paystub !== 'object') return null
  return paycheckVerificationKey(paystub)
}

/**
 * Append or replace a stub in the vault. De-duplicates by paystubKey (employer + period)
 * so re-saving the same stub just updates the existing entry.
 */
export function saveStubToVault(paystub, imageUrl = null) {
  const normalizedPaystub = normalizePaystubRecord(paystub)
  if (!normalizedPaystub) return null
  const key = vaultKeyFor(normalizedPaystub)
  const entry = {
    id: key || `stub-${Date.now()}`,
    paystubKey: key,
    savedAt: new Date().toISOString(),
    paystub: normalizedPaystub,
    imageUrl: typeof imageUrl === 'string' && imageUrl.length < 40_000 ? imageUrl : null,
  }
  const current = getPaystubVault()
  const idx = key ? current.findIndex(e => e.paystubKey === key) : -1
  let next
  if (idx >= 0) next = [entry, ...current.filter((_, i) => i !== idx)]
  else next = [entry, ...current]
  // Cap vault to last 24 stubs to stay well under localStorage budget.
  write(KEYS.VAULT, next.slice(0, 24))
  return entry
}

export function removeStubFromVault(id) {
  const current = getPaystubVault()
  write(KEYS.VAULT, current.filter(e => e.id !== id))
}

export function clearVault() {
  write(KEYS.VAULT, [])
}

/* -------------------------------------------------------------------------- */
/*  Anomaly feed                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Anomalies are small records the continuous wage-check and anomaly detectors write when
 * something looks off. Shape: { id, at, severity: 'info'|'warn'|'alert', title, detail }.
 */
export function getAnomalies() {
  const anomalies = read(KEYS.ANOMALIES)
  return Array.isArray(anomalies) ? anomalies : []
}

export function pushAnomaly(entry) {
  if (!entry || typeof entry !== 'object') return null
  const row = {
    id: `anom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    severity: ['info', 'warn', 'alert'].includes(entry.severity) ? entry.severity : 'warn',
    title: String(entry.title || 'Something looked off'),
    detail: String(entry.detail || ''),
    context: entry.context && typeof entry.context === 'object' ? entry.context : null,
    dismissed: false,
  }
  const current = getAnomalies()
  write(KEYS.ANOMALIES, [row, ...current].slice(0, 50))
  return row
}

export function dismissAnomaly(id) {
  const current = getAnomalies()
  write(KEYS.ANOMALIES, current.map(a => (a.id === id ? { ...a, dismissed: true } : a)))
}

export function clearAnomalies() {
  write(KEYS.ANOMALIES, [])
}

/** Oldest to newest, for charts. Sums totalDifference for all runs in each calendar month. */
export function getPersonalMonthlyFlaggedTrend() {
  const hist = getVerificationHistory()
  const buckets = new Map()
  for (const e of hist) {
    const d = new Date(e.at)
    const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' })
    const row = buckets.get(sortKey) || { sortKey, label, amount: 0 }
    row.amount += Number(e.totalDifference) || 0
    buckets.set(sortKey, row)
  }
  return [...buckets.values()]
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ label, amount }) => ({ month: label, amount: Math.round(amount * 100) / 100 }))
}

export function getUserState() {
  return read(KEYS.STATE) || 'TX'
}

export function saveUserState(stateCode) {
  write(KEYS.STATE, stateCode)
}

export function getUserCity() {
  return read(KEYS.CITY)
}

export function saveUserCity(city) {
  if (city) write(KEYS.CITY, city)
  else remove(KEYS.CITY)
}

export function getDocuments() {
  return read(KEYS.DOCUMENTS)
}

export function saveDocuments(docs) {
  write(KEYS.DOCUMENTS, docs)
}

export function getUserPreferences() {
  return { ...DEFAULT_PREFS, ...(read(KEYS.PREFS) || {}) }
}

export function saveUserPreferences(prefs) {
  write(KEYS.PREFS, { ...getUserPreferences(), ...prefs })
}

export function getOnboarding() {
  return read(KEYS.ONBOARDING)
}

export function saveOnboarding(data) {
  write(KEYS.ONBOARDING, { ...(read(KEYS.ONBOARDING) || {}), ...data })
}

export function getVerifiedPaycheckCount() {
  const keys = read(KEYS.VERIFIED_PAYCHECK_KEYS)
  return Array.isArray(keys) ? keys.length : 0
}

/** Snapshot for nav / onboarding (all client-side). */
export function getWorkflowProgress() {
  const shifts = getShifts()
  const paystub = getPaystub()
  const vio = getViolations()
  const timesheet = getTimesheetRecord()
  const normalized = normalizeAnalysis(vio)
  const hasPaystub = !!(
    paystub    && typeof paystub === 'object'
    && (
      (Number(paystub.hourly_rate) > 0)
      || (Number(paystub.hours_paid) > 0)
      || (Number(paystub.gross_pay) > 0)
    )
  )
  const hasCompared = !!(normalized?.summary)
  const verifiedCount = shifts.filter(s => s?.verification?.status === 'verified').length
  const hasTimesheet = !!(timesheet && Array.isArray(timesheet.entries) && timesheet.entries.length)
  return {
    shiftCount: shifts.length,
    hasShifts: shifts.length > 0,
    hasPaystub,
    hasCompared,
    hasTimesheet,
    verifiedCount,
    unverifiedCount: Math.max(0, shifts.length - verifiedCount),
    discrepancyCount: hasCompared ? normalized.discrepancies.length : 0,
    totalDifference: hasCompared ? Number(normalized.totalDifference) || 0 : 0,
  }
}

export function clearAll() {
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key)
  }
  notifyDataChanged()
}
