/**
 * Shared helpers for the integration proxy endpoints. Each upstream request is fully
 * constructed server-side; the browser only sends the token and the desired path + query.
 * This keeps tokens off the URL and lets us enforce a small allowlist of paths per
 * integration so these endpoints can't be turned into generic web proxies.
 */

export const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

export function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS })
}

export async function readJson(req) {
  try {
    const text = await req.text()
    if (!text) return {}
    return JSON.parse(text)
  } catch {
    throw new Error('Request body must be valid JSON.')
  }
}

export function buildUrl(base, path, query) {
  const url = new URL(path.startsWith('/') ? `${base}${path}` : `${base}/${path}`)
  if (query && typeof query === 'object') {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue
      url.searchParams.set(k, String(v))
    }
  }
  return url
}

export function ensureAllowed(allowed, path) {
  const clean = String(path || '').split('?')[0]
  const ok = allowed.some(a => {
    if (typeof a === 'string') return clean === a || clean.startsWith(a)
    if (a instanceof RegExp) return a.test(clean)
    return false
  })
  if (!ok) throw new Error(`Path not allowed by this integration proxy: ${clean}`)
}
