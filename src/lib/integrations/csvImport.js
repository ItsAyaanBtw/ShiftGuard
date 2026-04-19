import { buildShiftFromRange } from './shiftShape'

/**
 * Generic CSV import. Covers workforce-management apps that don't offer a friendly API for
 * individual employees (When I Work, Deputy, Homebase, 7shifts, Sling, Jibble) by letting
 * the user export their schedule or timesheet as CSV and drop the file in.
 *
 * The parser is tolerant of header aliases. Required columns (after alias mapping):
 *   - date          ("date", "shift date", "work date")
 *   - start         ("start", "start time", "clock in", "in")
 *   - end           ("end", "end time", "clock out", "out")
 * Optional:
 *   - break / break_minutes
 *   - tips
 *   - employer / site / location
 *   - external_id / id
 *
 * Shifts that end before they start get treated as overnight (end += 1 day).
 */

const HEADER_ALIASES = {
  date: ['date', 'shift date', 'work date', 'workdate', 'shift_date', 'startdate'],
  start: ['start', 'start time', 'clock in', 'in', 'clockin', 'start_time', 'in_time', 'scheduled start'],
  end: ['end', 'end time', 'clock out', 'out', 'clockout', 'end_time', 'out_time', 'scheduled end'],
  break: ['break', 'break minutes', 'break_minutes', 'unpaid break', 'meal', 'break mins'],
  tips: ['tips', 'tip', 'tips earned'],
  employer: ['employer', 'site', 'location', 'store', 'department', 'client'],
  externalId: ['id', 'external id', 'external_id', 'shift id', 'punch id'],
  label: ['role', 'position', 'job', 'task', 'description', 'notes'],
}

function parseCsv(text) {
  const rows = []
  let field = ''
  let row = []
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (quoted) {
      if (ch === '"' && next === '"') { field += '"'; i++ }
      else if (ch === '"') { quoted = false }
      else { field += ch }
    } else {
      if (ch === '"') { quoted = true }
      else if (ch === ',') { row.push(field); field = '' }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (ch === '\r') { /* skip */ }
      else { field += ch }
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''))
}

function buildHeaderMap(headerRow) {
  const lowered = headerRow.map(h => String(h || '').trim().toLowerCase())
  const map = {}
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = lowered.findIndex(h => aliases.includes(h))
    if (idx >= 0) map[canonical] = idx
  }
  return map
}

function combineDateAndTime(dateStr, timeStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  if (Number.isNaN(date.valueOf())) return null
  if (!timeStr) return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0)
  const clean = String(timeStr).trim()
  // Accept "HH:MM", "HH:MM AM/PM", or ISO
  const isoCombined = new Date(`${date.toISOString().slice(0, 10)}T${clean}`)
  if (!Number.isNaN(isoCombined.valueOf())) return isoCombined
  const m = clean.match(/^(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i)
  if (!m) return null
  let hour = Number(m[1])
  const minute = Number(m[2])
  const ampm = (m[3] || '').toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  const out = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute)
  return Number.isNaN(out.valueOf()) ? null : out
}

export function parseShiftsFromCsv(text, { source = 'csv_import' } = {}) {
  const rows = parseCsv(String(text || ''))
  if (rows.length < 2) return { shifts: [], skipped: 0, headerError: 'CSV has no data rows.' }
  const headerMap = buildHeaderMap(rows[0])
  if (headerMap.date == null || headerMap.start == null || headerMap.end == null) {
    return {
      shifts: [],
      skipped: Math.max(0, rows.length - 1),
      headerError: 'CSV is missing one of the required columns: date, start, end.',
    }
  }

  const shifts = []
  let skipped = 0
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const pick = key => (headerMap[key] != null ? String(row[headerMap[key]] ?? '') : '')
    const start = combineDateAndTime(pick('date'), pick('start'))
    let end = combineDateAndTime(pick('date'), pick('end'))
    if (start && end && end <= start) {
      // Overnight: bump end to next day.
      const bumped = new Date(end); bumped.setDate(bumped.getDate() + 1)
      end = bumped
    }
    const shift = buildShiftFromRange({
      start,
      end,
      breakMinutes: Number(pick('break')) || 0,
      tips: Number(pick('tips')) || 0,
      source,
      externalId: pick('externalId') || `${pick('date')}|${pick('start')}|${pick('end')}`,
      label: pick('label'),
      employer: pick('employer'),
    })
    if (shift) shifts.push(shift)
    else skipped += 1
  }

  return { shifts, skipped, headerError: null }
}
