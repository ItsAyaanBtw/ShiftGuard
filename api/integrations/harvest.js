import { json, readJson, buildUrl } from './_shared'

export const config = { runtime: 'edge' }

const BASE = 'https://api.harvestapp.com'

function pathAllowed(path) {
  if (path === '/v2/users/me') return true
  if (path === '/v2/time_entries') return true
  return false
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  let body
  try { body = await readJson(req) } catch (e) { return json(400, { error: e.message }) }

  const token = String(body?.token || '').trim()
  const accountId = String(body?.accountId || '').trim()
  const path = String(body?.path || '').trim()
  if (!token) return json(400, { error: 'Missing Harvest token' })
  if (!accountId) return json(400, { error: 'Missing Harvest account ID' })
  if (!path || !pathAllowed(path)) {
    return json(403, { error: 'Path not allowed by the Harvest proxy' })
  }

  const url = buildUrl(BASE, path, body?.query)
  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Harvest-Account-Id': accountId,
      Accept: 'application/json',
      'User-Agent': 'ShiftGuard (https://shiftguard.app)',
    },
  })
  const text = await upstream.text()
  if (!upstream.ok) return json(upstream.status, { error: `Harvest request failed (${upstream.status})`, raw: text })
  return new Response(text || '{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
}
