import { callProxy } from './proxyClient'
import { buildShiftFromRange } from './shiftShape'

/**
 * Harvest integration via a **Personal Access Token** + Account ID
 * (id.getharvest.com/developers). Reads `/v2/time_entries`.
 *
 * Harvest stores a spent date + hours (no native start/stop), so we use the `started_time`
 * and `ended_time` when available and fall back to `started_time + hours` otherwise.
 *
 * Docs: https://help.getharvest.com/api-v2/
 */

export const ADAPTER = {
  id: 'harvest',
  name: 'Harvest',
  kind: 'time_tracker',
  authType: 'token_and_account',
  connectHelp: 'Go to id.getharvest.com/developers, create a Personal Access Token, and note the Account ID for the Harvest account you want to connect.',
}

export async function verifyToken({ token, accountId }) {
  const data = await callProxy('/api/integrations/harvest', {
    token,
    accountId,
    path: '/v2/users/me',
    method: 'GET',
  })
  return data || null
}

export async function fetchEntries({ token, accountId, lookbehindDays = 14 }) {
  const from = new Date(); from.setDate(from.getDate() - Math.abs(lookbehindDays))
  const data = await callProxy('/api/integrations/harvest', {
    token,
    accountId,
    path: '/v2/time_entries',
    method: 'GET',
    query: { from: from.toISOString().slice(0, 10) },
  })
  return Array.isArray(data?.time_entries) ? data.time_entries : []
}

function harvestTimesToRange(entry) {
  const baseDate = entry.spent_date
  if (!baseDate) return null
  if (entry.started_time && entry.ended_time) {
    return {
      start: parseHarvestDateTime(baseDate, entry.started_time),
      end: parseHarvestDateTime(baseDate, entry.ended_time),
    }
  }
  const hours = Number(entry.hours) || 0
  if (hours <= 0) return null
  const start = new Date(`${baseDate}T09:00:00`)
  const end = new Date(start.getTime() + hours * 60 * 60 * 1000)
  return { start, end }
}

function parseHarvestDateTime(dateISO, timeStr) {
  if (!dateISO || !timeStr) return null
  const [raw, ampmRaw] = String(timeStr).trim().split(/\s+/)
  const [h, m] = raw.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  let hour = h
  const ampm = (ampmRaw || '').toLowerCase()
  if (ampm === 'pm' && hour < 12) hour += 12
  if (ampm === 'am' && hour === 12) hour = 0
  const d = new Date(`${dateISO}T${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
  return Number.isNaN(d.valueOf()) ? null : d
}

export async function importShifts({ token, accountId, lookbehindDays = 14 }) {
  const entries = await fetchEntries({ token, accountId, lookbehindDays })
  const shifts = []
  for (const e of entries) {
    const range = harvestTimesToRange(e)
    if (!range) continue
    const shift = buildShiftFromRange({
      start: range.start,
      end: range.end,
      source: ADAPTER.id,
      externalId: String(e.id),
      label: e.notes || e.task?.name || '',
      employer: e.client?.name || '',
    })
    if (shift) shifts.push(shift)
  }
  return shifts
}
