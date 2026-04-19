import { callProxy } from './proxyClient'
import { buildShiftFromRange } from './shiftShape'

/**
 * Toggl Track integration via a **Personal API Token** (Toggl > Profile > API token).
 * Reads `/me/time_entries` on the v9 API and maps each completed entry to a ShiftGuard
 * shift.
 *
 * Docs: https://engineering.toggl.com/docs/api/time_entries
 */

export const ADAPTER = {
  id: 'toggl',
  name: 'Toggl Track',
  kind: 'time_tracker',
  authType: 'token',
  connectHelp: 'In Toggl Track, click your avatar > Profile > API token and paste it below.',
}

export async function verifyToken({ token }) {
  const data = await callProxy('/api/integrations/toggl', {
    token,
    path: '/me',
    method: 'GET',
  })
  return data || null
}

export async function fetchEntries({ token, lookbehindDays = 14 }) {
  const start = new Date(); start.setDate(start.getDate() - Math.abs(lookbehindDays))
  const end = new Date(); end.setDate(end.getDate() + 1)
  const data = await callProxy('/api/integrations/toggl', {
    token,
    path: '/me/time_entries',
    method: 'GET',
    query: { start_date: start.toISOString(), end_date: end.toISOString() },
  })
  return Array.isArray(data) ? data : []
}

export async function importShifts({ token, lookbehindDays = 14 }) {
  const entries = await fetchEntries({ token, lookbehindDays })
  return entries
    .filter(e => e.start && e.stop) // skip running timers
    .map(e => buildShiftFromRange({
      start: e.start,
      end: e.stop,
      source: ADAPTER.id,
      externalId: String(e.id),
      label: e.description || '',
    }))
    .filter(Boolean)
}
