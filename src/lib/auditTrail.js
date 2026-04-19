/**
 * Read-only audit trail. Reconstructs a unified event timeline from the data we already
 * persist: shifts, stub uploads (vault), timesheet uploads, comparisons, and anomalies.
 *
 * Events are { id, at (ISO string), kind, title, detail, severity? }.
 */

import {
  getShifts, getPaystubVault, getVerificationHistory, getTimesheetRecord, getAnomalies,
} from './storage'

export function buildAuditTrail() {
  const events = []

  for (const s of getShifts()) {
    const when = s.date ? `${s.date}T00:00:00` : null
    if (!when) continue
    events.push({
      id: `shift-${s.id || when}`,
      at: when,
      kind: 'shift',
      title: `Shift logged · ${formatDate(s.date)}`,
      detail: `${s.clockIn || '?'} → ${s.clockOut || '?'}${s.breakMinutes ? ` · ${s.breakMinutes}m break` : ''}`,
    })
  }

  const vault = getPaystubVault()
  for (const entry of vault) {
    events.push({
      id: `stub-${entry.id}`,
      at: entry.savedAt,
      kind: 'stub',
      title: `Pay stub saved · ${entry.paystub?.employer_name || 'Employer'}`,
      detail: entry.paystub?.pay_period_start && entry.paystub?.pay_period_end
        ? `${entry.paystub.pay_period_start} → ${entry.paystub.pay_period_end} · gross $${safe(entry.paystub.gross_pay).toFixed(2)}`
        : `Gross $${safe(entry.paystub?.gross_pay).toFixed(2)}`,
    })
  }

  const timesheet = getTimesheetRecord()
  if (timesheet?.entries?.length) {
    events.push({
      id: `timesheet-${timesheet.source_label || timesheet.period_end || 'record'}`,
      at: timesheet.uploadedAt || new Date().toISOString(),
      kind: 'timesheet',
      title: `Time record uploaded · ${timesheet.source_label || 'Employer record'}`,
      detail: `${timesheet.entries.length} punches · ${timesheet.period_start || ''}${timesheet.period_end ? ` → ${timesheet.period_end}` : ''}`.trim(),
    })
  }

  for (const h of getVerificationHistory()) {
    events.push({
      id: `check-${h.at}-${h.paystubKey || ''}`,
      at: h.at,
      kind: 'check',
      title: `Paycheck check · ${h.employer || 'Employer'}`,
      detail: h.discrepancyCount
        ? `${h.discrepancyCount} item${h.discrepancyCount === 1 ? '' : 's'} flagged · $${safe(h.totalDifference).toFixed(2)}`
        : 'No items flagged',
      severity: h.discrepancyCount > 0 ? 'warn' : 'info',
    })
  }

  for (const a of getAnomalies()) {
    events.push({
      id: `anom-${a.id}`,
      at: a.at,
      kind: 'anomaly',
      title: a.title || 'Anomaly detected',
      detail: a.detail || '',
      severity: a.severity || 'warn',
    })
  }

  events.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  return events
}

function safe(n) { const x = Number(n); return Number.isFinite(x) ? x : 0 }

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.valueOf())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
