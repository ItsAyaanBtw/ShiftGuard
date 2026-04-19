/**
 * Tiny client that posts to ShiftGuard's own Vercel edge proxy so integration calls don't
 * hit CORS and don't force us to put user tokens in the browser URL. Each proxy endpoint
 * accepts a JSON body and returns the upstream JSON.
 */

const TIMEOUT_MS = 30_000

export async function callProxy(path, body) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    })
    const text = await res.text()
    let data
    try { data = text ? JSON.parse(text) : {} } catch { data = { rawText: text } }
    if (!res.ok) {
      const msg = data?.error?.message || data?.error || data?.message || `Request failed (${res.status})`
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg))
    }
    return data
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Integration request timed out.')
    throw err
  } finally {
    clearTimeout(timer)
  }
}
