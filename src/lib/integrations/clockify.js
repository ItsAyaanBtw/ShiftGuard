import { callProxy } from './proxyClient'
import { buildShiftFromRange } from './shiftShape'

/**
 * Clockify integration via an **API key** (Clockify > Profile Settings > API).
 * Uses the v1 REST API: `/user` to identify workspace + user, then
 * `/workspaces/{workspaceId}/user/{userId}/time-entries`.
 *
 * Docs: https://docs.clockify.me/
 */

export const ADAPTER = {
  id: 'clockify',
  name: 'Clockify',
  kind: 'time_tracker',
  authType: 'token',
  connectHelp: 'In Clockify, open Profile Settings and generate an API key at the bottom of the page. Paste it below.',
}

export async function verifyToken({ token }) {
  const data = await callProxy('/api/integrations/clockify', {
    token,
    path: '/user',
    method: 'GET',
  })
  return data || null
}

export async function fetchEntries({ token, lookbehindDays = 14 }) {
  const me = await verifyToken({ token })
  if (!me?.id || !me?.activeWorkspace) {
    throw new Error('Could not resolve Clockify user or workspace.')
  }
  const start = new Date(); start.setDate(start.getDate() - Math.abs(lookbehindDays))
  const end = new Date(); end.setDate(end.getDate() + 1)
  const data = await callProxy('/api/integrations/clockify', {
    token,
    path: `/workspaces/${me.activeWorkspace}/user/${me.id}/time-entries`,
    method: 'GET',
    query: { start: start.toISOString(), end: end.toISOString(), 'page-size': 200 },
  })
  return Array.isArray(data) ? data : []
}

export async function importShifts({ token, lookbehindDays = 14 }) {
  const entries = await fetchEntries({ token, lookbehindDays })
  return entries
    .filter(e => e?.timeInterval?.start && e?.timeInterval?.end)
    .map(e => buildShiftFromRange({
      start: e.timeInterval.start,
      end: e.timeInterval.end,
      source: ADAPTER.id,
      externalId: e.id,
      label: e.description || '',
    }))
    .filter(Boolean)
}
