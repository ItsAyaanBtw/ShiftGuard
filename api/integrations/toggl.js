import { json, readJson, buildUrl, ensureAllowed } from './_shared'

export const config = { runtime: 'edge' }

const BASE = 'https://api.track.toggl.com/api/v9'
const ALLOWED = ['/me', '/me/time_entries', '/workspaces']

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  let body
  try { body = await readJson(req) } catch (e) { return json(400, { error: e.message }) }

  const token = String(body?.token || '').trim()
  const path = String(body?.path || '').trim()
  if (!token) return json(400, { error: 'Missing Toggl token' })
  if (!path) return json(400, { error: 'Missing path' })
  try { ensureAllowed(ALLOWED, path) } catch (e) { return json(403, { error: e.message }) }

  const url = buildUrl(BASE, path, body?.query)
  const basic = (typeof btoa === 'function')
    ? btoa(`${token}:api_token`)
    : Buffer.from(`${token}:api_token`).toString('base64')

  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${basic}`,
      Accept: 'application/json',
    },
  })
  const text = await upstream.text()
  if (!upstream.ok) return json(upstream.status, { error: `Toggl request failed (${upstream.status})`, raw: text })
  return new Response(text || '{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
}
