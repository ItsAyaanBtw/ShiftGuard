import { json, readJson, buildUrl, ensureAllowed } from './_shared'

export const config = { runtime: 'edge' }

const BASE = 'https://api.calendly.com'
const ALLOWED = ['/users/me', '/scheduled_events', '/event_types', '/organizations']

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  let body
  try { body = await readJson(req) } catch (e) { return json(400, { error: e.message }) }

  const token = String(body?.token || '').trim()
  const path = String(body?.path || '').trim()
  const method = (body?.method || 'GET').toUpperCase()
  if (!token) return json(400, { error: 'Missing Calendly token' })
  if (!path) return json(400, { error: 'Missing path' })
  try { ensureAllowed(ALLOWED, path) } catch (e) { return json(403, { error: e.message }) }

  const url = buildUrl(BASE, path, body?.query)
  const init = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  }
  if (method !== 'GET' && body?.body) init.body = JSON.stringify(body.body)

  const upstream = await fetch(url, init)
  const text = await upstream.text()
  if (!upstream.ok) {
    return json(upstream.status, {
      error: safeJson(text)?.message || `Calendly request failed (${upstream.status})`,
      upstream: safeJson(text) || text,
    })
  }
  return new Response(text || '{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function safeJson(s) {
  try { return JSON.parse(s) } catch { return null }
}
