/**
 * Shared shift-shape utilities. Every integration adapter must produce shift objects that
 * match what the rest of ShiftGuard expects (same fields as `newShiftTemplate` in the
 * ShiftLogger), so they can be merged into the shift log without special-casing.
 *
 * Canonical fields:
 *   id, date (YYYY-MM-DD), clockIn (HH:MM), clockOut (HH:MM), breakMinutes, tips,
 *   flaggedOT, shiftType ('day'|'evening'|'night'), isWeekend, isHoliday, chargeNurse,
 *   preceptor, onCallHours, source (adapter id), externalId (stable id from the source).
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function toIsoDate(dateLike) {
  if (!dateLike) return ''
  if (typeof dateLike === 'string' && ISO_DATE_RE.test(dateLike.slice(0, 10))) {
    return dateLike.slice(0, 10)
  }
  const d = new Date(dateLike)
  if (Number.isNaN(d.valueOf())) return ''
  return d.toISOString().slice(0, 10)
}

export function toHHMM(dateLike) {
  if (!dateLike) return ''
  const d = new Date(dateLike)
  if (Number.isNaN(d.valueOf())) return ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function classifyShiftType(startDate) {
  if (!startDate) return 'day'
  const d = new Date(startDate)
  if (Number.isNaN(d.valueOf())) return 'day'
  const h = d.getHours()
  if (h >= 19 || h < 5) return 'night'
  if (h >= 14) return 'evening'
  return 'day'
}

function isWeekendDate(dateISO) {
  if (!dateISO) return false
  const d = new Date(`${dateISO}T00:00:00`)
  if (Number.isNaN(d.valueOf())) return false
  const dow = d.getDay()
  return dow === 0 || dow === 6
}

function genLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `shift-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Build a canonical ShiftGuard shift from any time range + source metadata.
 * Returns `null` if start or end are missing/invalid or end is not after start.
 */
export function buildShiftFromRange({
  start,
  end,
  breakMinutes = 0,
  tips = 0,
  source = 'import',
  externalId = '',
  label = '',
  employer = '',
}) {
  const startDate = start ? new Date(start) : null
  const endDate = end ? new Date(end) : null
  if (!startDate || !endDate || Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf())) {
    return null
  }
  if (endDate <= startDate) return null

  const dateISO = toIsoDate(startDate)
  return {
    id: genLocalId(),
    date: dateISO,
    clockIn: toHHMM(startDate),
    clockOut: toHHMM(endDate),
    breakMinutes: Math.max(0, Math.round(Number(breakMinutes) || 0)),
    tips: Math.max(0, Number(tips) || 0),
    flaggedOT: false,
    shiftType: classifyShiftType(startDate),
    isWeekend: isWeekendDate(dateISO),
    isHoliday: false,
    chargeNurse: false,
    preceptor: false,
    onCallHours: 0,
    source,
    externalId: String(externalId || ''),
    importLabel: String(label || ''),
    employer: String(employer || ''),
  }
}

/**
 * De-duplicate by (source, externalId). Used when merging imported shifts back into the
 * existing shift log so re-importing the same window is safe and idempotent.
 */
export function mergeShifts(existing, incoming) {
  const keyFor = s => (s.source && s.externalId ? `${s.source}::${s.externalId}` : '')
  const seen = new Map()
  for (const s of existing) {
    const k = keyFor(s)
    if (k) seen.set(k, s)
  }
  const additions = []
  for (const s of incoming) {
    const k = keyFor(s)
    if (k && seen.has(k)) continue
    if (k) seen.set(k, s)
    additions.push(s)
  }
  return { merged: [...existing, ...additions], added: additions.length }
}
