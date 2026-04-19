/**
 * OCR.space client — first layer of the hybrid OCR + LLM pipeline.
 *
 * Why:
 *   Claude Vision was collapsing multi-column paystubs (earnings columns + YTD
 *   columns + deductions column) into a single rail, costing us the
 *   current-vs-YTD distinction and often the rate column entirely. OCR.space's
 *   layout-aware engine 2 preserves tabular structure much better. We send
 *   the raw text to Claude as a plain-text prompt, not a vision prompt, and let
 *   Claude handle the structural mapping into our JSON schema.
 *
 * Contract:
 *   - `extractTextFromImage(input, mediaType)` returns a trimmed plain-text
 *     string on success, throws an Error with a user-presentable message on
 *     failure.
 *   - `input` may be a File, a Blob, or a base64 string (no data:/uri prefix).
 *   - Client-side only. No backend required. CORS is enabled on the OCR.space
 *     endpoint by policy.
 *
 * Key:
 *   Defaults to the public demo key `helloworld` (rate-limited but works
 *   out of the box for the hackathon). Set `VITE_OCR_SPACE_API_KEY` in
 *   .env.local to upgrade to your own key without touching code.
 */

const OCR_ENDPOINT = 'https://api.ocr.space/parse/image'

function getApiKey() {
  const raw = (import.meta.env.VITE_OCR_SPACE_API_KEY || '').trim()
  if (raw && !/REPLACE_ME|your_api_key_here/i.test(raw) && raw.length >= 6) return raw
  // Public demo key. Rate limits apply but every request returns real OCR.
  return 'helloworld'
}

function normalizeMediaType(mediaType) {
  const m = String(mediaType || '').toLowerCase()
  if (m === 'image/jpg') return 'image/jpeg'
  if (m.startsWith('image/')) return m
  if (m === 'application/pdf') return 'application/pdf'
  return 'image/jpeg'
}

function buildFormData(input, mediaType) {
  const form = new FormData()
  const key = getApiKey()

  // Body — one of file | base64Image is required. Prefer file when we have a
  // Blob so the server can stream it directly.
  if (typeof input === 'string') {
    const prefix = `data:${normalizeMediaType(mediaType)};base64,`
    const blob = input.startsWith('data:') ? input : `${prefix}${input}`
    form.append('base64Image', blob)
  } else if (input instanceof Blob || input instanceof File) {
    form.append('file', input, input.name || 'paystub')
  } else {
    throw new Error('extractTextFromImage: input must be a File, Blob, or base64 string.')
  }

  // Engine 2 is layout-aware. Engine 1 is the default and collapses columns.
  form.append('OCREngine', '2')
  form.append('language', 'eng')
  form.append('scale', 'true')
  form.append('detectOrientation', 'true')
  form.append('isOverlayRequired', 'false')
  // Paystubs are tabular by nature. Turning on isTable preserves row/column
  // spacing that would otherwise be flattened into free text.
  form.append('isTable', 'true')
  form.append('apikey', key)
  return form
}

function parsedTextFromResponse(data) {
  if (!data || typeof data !== 'object') return ''
  if (data.IsErroredOnProcessing) return ''
  const results = Array.isArray(data.ParsedResults) ? data.ParsedResults : []
  return results
    .map(r => (r && typeof r.ParsedText === 'string' ? r.ParsedText : ''))
    .filter(Boolean)
    .join('\n')
    .replace(/\r\n/g, '\n')
    .trim()
}

/**
 * Main entrypoint. Returns a clean plain-text string on success.
 *
 * @param {File|Blob|string} input   The paystub image (File/Blob) or base64 string.
 * @param {string} [mediaType]       Content-type hint, only used for base64 input.
 * @param {AbortSignal} [signal]     Optional abort signal for cancellation.
 * @returns {Promise<string>}
 */
export async function extractTextFromImage(input, mediaType = 'image/jpeg', signal) {
  let form
  try {
    form = buildFormData(input, mediaType)
  } catch (err) {
    throw new Error(err.message || 'Could not package image for OCR.')
  }

  let res
  try {
    res = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      body: form,
      signal,
      // Don't set Content-Type manually; the browser sets the multipart
      // boundary. Don't send cookies; this is a public API.
      credentials: 'omit',
      mode: 'cors',
    })
  } catch (err) {
    if (err?.name === 'AbortError') throw err
    throw new Error('OCR service could not be reached. Check your connection and try again.')
  }

  if (!res.ok) {
    // OCR.space returns HTTP 200 even for "bad key" errors; anything non-200
    // is likely a CDN / network issue.
    throw new Error(`OCR service returned ${res.status}. Try again in a moment.`)
  }

  let data
  try {
    data = await res.json()
  } catch {
    throw new Error('OCR service returned an unreadable response.')
  }

  if (data?.IsErroredOnProcessing) {
    const msg = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join('; ')
      : String(data.ErrorMessage || 'OCR failed')
    // Surface the most common failure modes in plain language.
    if (/API Key/i.test(msg)) {
      throw new Error('OCR API key was rejected. Set VITE_OCR_SPACE_API_KEY in .env.local and restart the dev server.')
    }
    if (/file is not supported|unsupported file/i.test(msg)) {
      throw new Error('OCR could not read that file type. Try a JPG, PNG, or PDF.')
    }
    if (/timed out|timeout/i.test(msg)) {
      throw new Error('OCR timed out on a large image. Crop the paystub and try again.')
    }
    throw new Error(`OCR: ${msg}`)
  }

  const text = parsedTextFromResponse(data)
  if (!text) {
    throw new Error('OCR returned no text. The image may be blank, too small, or heavily rotated.')
  }
  return text
}

/**
 * Lightweight health probe. Useful if you want to gate the UI on OCR
 * availability without burning a real request on every render.
 */
export async function isOcrReachable(signal) {
  try {
    const res = await fetch(OCR_ENDPOINT, { method: 'OPTIONS', signal, mode: 'cors' })
    return res.ok || res.status === 204
  } catch {
    return false
  }
}
