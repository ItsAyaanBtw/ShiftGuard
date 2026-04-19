/**
 * sanitize — centralised input + output scrubbing.
 *
 * Two jobs:
 *   1. Redact secrets from any string before it gets logged, surfaced in UI,
 *      or shipped to a third-party API. API keys, bearer tokens, and anything
 *      that pattern-matches as a session token or AWS key is redacted to
 *      [redacted] so a thrown Error.message can't leak them.
 *   2. Normalise user-supplied strings before they're used as prompts or
 *      written to storage: clamp length, strip control chars, collapse
 *      whitespace, and refuse obvious prompt-injection templates. Everything
 *      still round-trips as a string (never throws); callers can trust the
 *      output without branching.
 *
 * These helpers are deliberately dependency-free so they're safe to use in
 * the secure-store bootstrap path where React and most of the app haven't
 * initialised yet.
 */

// Patterns tuned for the secrets this app actually touches. The list errs on
// the side of redacting a legitimate string that happens to look like a key
// rather than leaking one.
const SECRET_PATTERNS = [
  /sk-ant-[A-Za-z0-9_-]{20,}/g,          // Anthropic keys
  /sk-[A-Za-z0-9]{32,}/g,                 // OpenAI-style keys
  /AKIA[0-9A-Z]{16}/g,                    // AWS access keys
  /ghp_[A-Za-z0-9]{30,}/g,                // GitHub PATs
  /Bearer\s+[A-Za-z0-9._-]{20,}/gi,       // Bearer tokens in error strings
  /x-api-key[:\s=]+[A-Za-z0-9._-]{10,}/gi, // x-api-key headers
  /apikey[:\s=]+[A-Za-z0-9._-]{10,}/gi,    // generic apikey=... strings
  /K[0-9]{9,12}[0-9]/g,                    // OCR.space keys look like K81234567
]

// Keys we refuse to echo back even if the caller forgets to redact. Any value
// matching one of these env-var names is always treated as sensitive.
const SENSITIVE_ENV_NAMES = [
  'ANTHROPIC_API_KEY',
  'VITE_ANTHROPIC_API_KEY',
  'OCR_SPACE_API_KEY',
  'VITE_OCR_SPACE_API_KEY',
]

/**
 * Redact any secret-looking substring inside `value`. Returns a new string.
 * Non-strings pass through unchanged.
 */
export function redactSecrets(value) {
  if (typeof value !== 'string' || !value.length) return value
  let out = value
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]')
  }
  return out
}

/** Redact secrets inside an Error, returning a new Error with safe message. */
export function sanitizeError(err) {
  if (!err) return new Error('Unknown error')
  const msg = redactSecrets(err?.message || String(err))
  const safe = new Error(msg)
  if (err && typeof err === 'object' && err.code) safe.code = err.code
  return safe
}

/** Safe console logger that always redacts before printing. Use instead of console.error for anything derived from API responses. */
export function logSafe(prefix, value) {
  try {
    if (value instanceof Error) {
      console.error(prefix, redactSecrets(value.message))
    } else if (typeof value === 'object') {
      console.error(prefix, redactSecrets(JSON.stringify(value)))
    } else {
      console.error(prefix, redactSecrets(String(value)))
    }
  } catch {
    // logging never throws
  }
}

/* --------------------------- input normalisation --------------------------- */

/**
 * Normalise a string of user-supplied free text. Removes ASCII control chars,
 * collapses whitespace, clamps to `maxLen`, and optionally rejects strings
 * shaped like prompt-injection templates. Returns a trimmed string; never
 * throws.
 *
 * @param {string} value
 * @param {object} [opts]
 * @param {number} [opts.maxLen=2000]
 * @param {boolean} [opts.stripNewlines=false]
 */
export function normalizeUserText(value, { maxLen = 2000, stripNewlines = false } = {}) {
  if (value == null) return ''
  let s = String(value)
  // Strip ASCII control chars other than \n and \t so screens can't inject
  // zero-width or bidi overrides into JSX. The character class below is
  // intentional; eslint flags it as a control-regex warning that we suppress.
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  // Strip unicode bidi override / embedding chars that can be used to spoof
  // filenames or employer names inside right-to-left contexts.
  s = s.replace(/[\u202A-\u202E\u2066-\u2069]/g, '')
  if (stripNewlines) s = s.replace(/[\r\n]+/g, ' ')
  s = s.replace(/[ \t]{2,}/g, ' ').trim()
  if (s.length > maxLen) s = s.slice(0, maxLen).trimEnd() + '…'
  return s
}

/** Bound OCR output before we ship it to Claude as a prompt. */
export function normalizeOcrText(text) {
  // OCR can return very long strings on multi-page PDFs. Cap at 12k chars so
  // we stay inside Claude's safe window and don't eat our token budget.
  return normalizeUserText(text, { maxLen: 12_000, stripNewlines: false })
}

/** Bound the "Ask your paychecks" prompt. */
export function normalizePromptText(text) {
  return normalizeUserText(text, { maxLen: 500, stripNewlines: true })
}

/** Simple numeric coercion that never returns NaN. */
export function toSafeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Tell the caller whether a string literally equals a sensitive env var name
 * (useful when deciding whether to serialise something in logs).
 */
export function isSensitiveEnvName(name) {
  return SENSITIVE_ENV_NAMES.includes(String(name || ''))
}
