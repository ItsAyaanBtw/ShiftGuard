import { callProxy } from './proxyClient'
import { buildShiftFromRange } from './shiftShape'

/**
 * Google Calendar integration via a **public/secret iCal URL**.
 *
 * Rationale: OAuth flows for Google Calendar require a registered GCP client ID and a
 * real backend for the refresh-token dance, which is out of scope for a static Vercel app
 * with BYOK philosophy. Every Google Calendar exposes a per-calendar "Secret address in
 * iCal format" (`Settings > {calendar} > Integrate calendar > Secret address in iCal
 * format`). Pasting that URL is a one-step equivalent of OAuth, with fewer moving parts.
 *
 * The URL is sent to our edge proxy (`/api/integrations/ical`) because browsers can't
 * fetch Google's `calendar.google.com` directly (no CORS headers). Tokens never leave
 * localStorage.
 */

export const ADAPTER = {
  id: 'google_calendar',
  name: 'Google Calendar',
  kind: 'calendar',
  authType: 'ical_url',
  connectHelp: 'In Google Calendar, open the calendar you use for your shifts, then go to Settings > Integrate calendar and copy the "Secret address in iCal format" URL. Paste it below.',
}

function parseIcs(ics) {
  // Minimal RFC 5545 subset parser good enough for Google Calendar and Apple Calendar exports.
  const events = []
  const lines = String(ics || '')
    .replace(/\r\n[ \t]/g, '')
    .split(/\r?\n/)
  let cur = null
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {} ; continue }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue }
    if (!cur || !line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const rawKey = line.slice(0, idx)
    const value = line.slice(idx + 1)
    const [keyName] = rawKey.split(';')
    const params = Object.fromEntries(
      rawKey.split(';').slice(1).map(p => p.split('=').map(s => s?.trim())),
    )
    switch (keyName) {
      case 'DTSTART': cur.start = toDate(value, params); break
      case 'DTEND':   cur.end = toDate(value, params); break
      case 'SUMMARY': cur.summary = unescapeIcs(value); break
      case 'UID':     cur.uid = value; break
      case 'LOCATION': cur.location = unescapeIcs(value); break
      case 'DESCRIPTION': cur.description = unescapeIcs(value); break
      default: break
    }
  }
  return events
}

function unescapeIcs(v) {
  return String(v || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';')
}

function toDate(value, params = {}) {
  const trimmed = String(value || '').trim()
  if (!trimmed) return null
  // YYYYMMDD or YYYYMMDDTHHMMSSZ or local YYYYMMDDTHHMMSS
  const isDateOnly = params.VALUE === 'DATE' || /^\d{8}$/.test(trimmed)
  if (isDateOnly) {
    const y = trimmed.slice(0, 4)
    const mo = trimmed.slice(4, 6)
    const d = trimmed.slice(6, 8)
    const dt = new Date(`${y}-${mo}-${d}T00:00:00`)
    return Number.isNaN(dt.valueOf()) ? null : dt
  }
  const m = trimmed.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/)
  if (!m) return null
  const [, y, mo, d, hh, mm, ss, z] = m
  const iso = `${y}-${mo}-${d}T${hh}:${mm}:${ss}${z ? 'Z' : ''}`
  const dt = new Date(iso)
  return Number.isNaN(dt.valueOf()) ? null : dt
}

export async function fetchEvents({ icalUrl, lookaheadDays = 28, lookbehindDays = 7 }) {
  if (!icalUrl) throw new Error('Missing iCal URL.')
  const { text } = await callProxy('/api/integrations/ical', { icalUrl })
  const events = parseIcs(text)

  const now = new Date()
  const from = new Date(now); from.setDate(from.getDate() - Math.abs(lookbehindDays))
  const to = new Date(now); to.setDate(to.getDate() + Math.abs(lookaheadDays))

  return events.filter(e => e.start && e.end && e.start >= from && e.start <= to)
}

export async function importShifts({ icalUrl, lookaheadDays = 28, lookbehindDays = 7 }) {
  const events = await fetchEvents({ icalUrl, lookaheadDays, lookbehindDays })
  return events
    .map(e => buildShiftFromRange({
      start: e.start,
      end: e.end,
      source: ADAPTER.id,
      externalId: e.uid || `${e.start?.toISOString()}|${e.summary}`,
      label: e.summary || '',
      employer: e.location || '',
    }))
    .filter(Boolean)
}
