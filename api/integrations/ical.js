import { json, readJson } from './_shared'

export const config = { runtime: 'edge' }

/**
 * Fetches a public iCal feed server-side (Google/Apple Calendar secret iCal URLs) and
 * returns the raw text back to the client. Only allows https and a few well-known hosts
 * so this endpoint can't be abused as a generic web proxy.
 */

const ALLOWED_HOSTS = new Set([
  'calendar.google.com',
  'www.google.com',
  'p01-caldav.icloud.com',
  'p02-caldav.icloud.com',
  'p03-caldav.icloud.com',
  'p04-caldav.icloud.com',
  'p05-caldav.icloud.com',
  'outlook.live.com',
  'outlook.office.com',
  'calendar.yahoo.com',
])

function isAllowed(url) {
  return ALLOWED_HOSTS.has(url.host) || url.host.endsWith('.icloud.com') || url.host.endsWith('.google.com')
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  let body
  try { body = await readJson(req) } catch (e) { return json(400, { error: e.message }) }

  const icalUrl = String(body?.icalUrl || '').trim()
  if (!icalUrl) return json(400, { error: 'Missing icalUrl' })

  let url
  try { url = new URL(icalUrl) } catch { return json(400, { error: 'Invalid URL' }) }
  if (url.protocol !== 'https:') return json(400, { error: 'Only https URLs are allowed' })
  if (!isAllowed(url)) return json(403, { error: 'Host not allowed by the iCal proxy' })

  const upstream = await fetch(url, {
    headers: { Accept: 'text/calendar, text/plain, */*' },
  })
  if (!upstream.ok) return json(upstream.status, { error: `Upstream returned ${upstream.status}` })
  const text = await upstream.text()
  if (!text.includes('BEGIN:VCALENDAR')) {
    return json(422, { error: 'Response did not look like an iCal feed' })
  }
  return json(200, { text })
}
