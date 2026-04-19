import { callProxy } from './proxyClient'
import { buildShiftFromRange } from './shiftShape'

/**
 * Calendly v2 integration via a **Personal Access Token** (Calendly > Integrations >
 * Developer > Generate new token). The token calls the v2 API for `scheduled_events`.
 *
 * We use Calendly less for "shift scheduling" and more as a drop-in way for contract /
 * consulting / home-health workers who already use Calendly to keep their own appointment
 * list. Each event becomes a projected "shift" with the organizer's timezone respected.
 *
 * Docs: https://developer.calendly.com/api-docs/
 */

export const ADAPTER = {
  id: 'calendly',
  name: 'Calendly',
  kind: 'calendar',
  authType: 'token',
  connectHelp: 'In Calendly, go to Integrations > API & Webhooks > Personal Access Tokens, generate a token, and paste it below.',
}

async function getCurrentUser({ token }) {
  return callProxy('/api/integrations/calendly', {
    token,
    path: '/users/me',
    method: 'GET',
  })
}

export async function verifyToken({ token }) {
  const data = await getCurrentUser({ token })
  return data?.resource || null
}

export async function fetchScheduledEvents({
  token,
  userUri,
  lookbehindDays = 7,
  lookaheadDays = 28,
}) {
  const me = userUri || (await getCurrentUser({ token }))?.resource?.uri
  if (!me) throw new Error('Could not determine Calendly user.')
  const from = new Date(); from.setDate(from.getDate() - Math.abs(lookbehindDays))
  const to = new Date(); to.setDate(to.getDate() + Math.abs(lookaheadDays))

  const data = await callProxy('/api/integrations/calendly', {
    token,
    path: '/scheduled_events',
    method: 'GET',
    query: {
      user: me,
      min_start_time: from.toISOString(),
      max_start_time: to.toISOString(),
      status: 'active',
      count: 100,
    },
  })
  return Array.isArray(data?.collection) ? data.collection : []
}

export async function importShifts({ token, ...opts }) {
  const events = await fetchScheduledEvents({ token, ...opts })
  return events
    .map(ev => buildShiftFromRange({
      start: ev.start_time,
      end: ev.end_time,
      source: ADAPTER.id,
      externalId: ev.uri,
      label: ev.name || 'Calendly event',
      employer: ev.location?.location || '',
    }))
    .filter(Boolean)
}
