import { json, readJson, buildUrl } from './_shared'

export const config = { runtime: 'edge' }

const BASE = 'https://api.clockify.me/api/v1'

function pathAllowed(path) {
  if (path === '/user') return true
  if (path.startsWith('/workspaces/')) return true
  return false
}

export default async function handler(req) {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })
  let body
  try { body = await readJson(req) } catch (e) { return json(400, { error: e.message }) }

  const token = String(body?.token || '').trim()
  const path = String(body?.path || '').trim()
  if (!token) return json(400, { error: 'Missing Clockify API key' })
  if (!path || !pathAllowed(path)) {
    return json(403, { error: 'Path not allowed by the Clockify proxy' })
  }

  const url = buildUrl(BASE, path, body?.query)
  const upstream = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Api-Key': token,
      Accept: 'application/json',
    },
  })
  const text = await upstream.text()
  if (!upstream.ok) return json(upstream.status, { error: `Clockify request failed (${upstream.status})`, raw: text })
  return new Response(text || '{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
}
