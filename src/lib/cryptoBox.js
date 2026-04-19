/**
 * cryptoBox — AES-GCM 256 + PBKDF2-SHA256 primitives for at-rest encryption of
 * ShiftGuard data in localStorage.
 *
 * We use WebCrypto (SubtleCrypto) which is available in all modern browsers and
 * backed by the platform's native crypto (hardware-accelerated on most chips).
 *
 * Threat model (what this defends against):
 *   - A file-system attacker who dumps localStorage cannot read paystubs, shifts,
 *     timesheets, or vault entries without the account password or guest device key.
 *   - Malicious browser extensions that only read storage (not inject script) cannot
 *     pull out plaintext PII.
 *
 * What this DOES NOT defend against (and we say so out loud in /security):
 *   - JS-level XSS inside the same origin. A script running as ShiftGuard has the
 *     key in memory during the session. The defense is not rolling our own auth —
 *     the defense is (a) strict CSP, (b) no untrusted HTML is ever innerHTML'd,
 *     (c) the app talks to no server storing user data.
 *   - A compromised device. Someone on your unlocked laptop can simply type in the
 *     password. That's true of everything.
 *
 * Format on disk (JSON serialized):
 *   { v: 1, iv: base64-12B, ct: base64-ciphertext-with-tag }
 *
 * Key derivation:
 *   - Authenticated accounts: PBKDF2(SHA-256, 200_000 iters) over `password` with
 *     the account's `dataSalt` (distinct from the password-hash salt). Output 32
 *     bytes imported as AES-GCM 256.
 *   - Guest: a random 32-byte key generated once and stored under
 *     `shiftguard_guest_dk_v1`. This is weaker (the key sits next to the data on
 *     disk) but still forces decryption through one known code path, and any
 *     future migration to a master passphrase can rewrap it.
 *
 * Session caching:
 *   - After sign-in we store the raw 32 bytes in sessionStorage under
 *     `shiftguard_session_dk`. sessionStorage is scoped to the tab and wiped on
 *     tab close, giving us "reload stays unlocked, new tab requires sign-in"
 *     semantics without a server.
 */

const PBKDF2_ITERS = 200_000
const KEY_LEN_BITS = 256
const IV_LEN = 12
const SESSION_KEY_STORAGE = 'shiftguard_session_dk'
const GUEST_DEVICE_KEY_STORAGE = 'shiftguard_guest_dk_v1'

/* ------------------------------ base64 helpers ----------------------------- */

function bytesToBase64(bytes) {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}
function base64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/* ------------------------------ key material ------------------------------- */

export function hasWebCrypto() {
  return (
    typeof crypto !== 'undefined' &&
    !!crypto.subtle &&
    typeof crypto.subtle.importKey === 'function'
  )
}

/**
 * Derive a 256-bit AES-GCM key from a password + hex salt via PBKDF2-SHA256.
 * Returns the raw 32-byte key as a Uint8Array.
 */
export async function deriveRawKeyFromPassword(password, saltHex) {
  if (!hasWebCrypto()) throw new Error('WebCrypto not available')
  const enc = new TextEncoder()
  const pwKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(password || '')),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  )
  const saltBytes = hexToBytes(saltHex)
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: saltBytes,
      iterations: PBKDF2_ITERS,
    },
    pwKey,
    KEY_LEN_BITS,
  )
  return new Uint8Array(bits)
}

/**
 * Import raw key bytes as a non-extractable AES-GCM CryptoKey suitable for
 * encrypt/decrypt.
 */
export async function importAesKey(rawBytes) {
  if (!hasWebCrypto()) throw new Error('WebCrypto not available')
  return crypto.subtle.importKey(
    'raw',
    rawBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Generate a cryptographically random 32-byte key. */
export function randomRawKey() {
  const out = new Uint8Array(32)
  crypto.getRandomValues(out)
  return out
}

/** Hex string to bytes. Accepts lowercase or uppercase. */
function hexToBytes(hex) {
  const clean = String(hex || '').replace(/[^0-9a-f]/gi, '')
  const out = new Uint8Array(Math.floor(clean.length / 2))
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16)
  }
  return out
}

/* ------------------------------ session cache ------------------------------ */

/** Stores the raw key for this browsing session (tab lifetime). */
export function setSessionRawKey(rawBytes) {
  try {
    if (!rawBytes) {
      sessionStorage.removeItem(SESSION_KEY_STORAGE)
      return
    }
    sessionStorage.setItem(SESSION_KEY_STORAGE, bytesToBase64(rawBytes))
  } catch {
    /* sessionStorage can be disabled; encryption then only works for the active
       call stack but the app still runs. */
  }
}

export function getSessionRawKey() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_STORAGE)
    return raw ? base64ToBytes(raw) : null
  } catch {
    return null
  }
}

export function clearSessionRawKey() {
  try {
    sessionStorage.removeItem(SESSION_KEY_STORAGE)
  } catch {
    /* noop */
  }
}

/* ------------------------------ guest device key --------------------------- */

/**
 * Guest accounts don't have a password so we can't derive a key. Instead we
 * generate a random key once per browser and persist it in localStorage.
 * This is weaker than password-based encryption (the key sits on disk), but the
 * app still never writes plaintext paystubs, and a future upgrade can rewrap the
 * guest key under a real passphrase.
 */
export function getOrCreateGuestDeviceKey() {
  try {
    const existing = localStorage.getItem(GUEST_DEVICE_KEY_STORAGE)
    if (existing) return base64ToBytes(existing)
    const fresh = randomRawKey()
    localStorage.setItem(GUEST_DEVICE_KEY_STORAGE, bytesToBase64(fresh))
    return fresh
  } catch {
    // Fallback if localStorage is blocked — return a fresh key that only lives
    // for the current call stack. Data written with this won't be decryptable
    // later, which is a valid failure mode.
    return randomRawKey()
  }
}

export function rotateGuestDeviceKey() {
  const fresh = randomRawKey()
  try {
    localStorage.setItem(GUEST_DEVICE_KEY_STORAGE, bytesToBase64(fresh))
  } catch {
    /* noop */
  }
  return fresh
}

/* --------------------------------- crypto ---------------------------------- */

/**
 * Encrypt a JS value. Returns the JSON-serialized envelope string (ready for
 * direct localStorage write).
 */
export async function encryptValue(value, cryptoKey) {
  if (!hasWebCrypto()) {
    // If WebCrypto isn't there, fall back to a plain JSON envelope marked as
    // unencrypted so downstream decrypt knows to pass through. This keeps the
    // app functioning on legacy browsers while making the failure mode obvious.
    return JSON.stringify({ v: 0, raw: value })
  }
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const enc = new TextEncoder()
  const plaintext = enc.encode(JSON.stringify(value ?? null))
  const ctBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    plaintext,
  )
  return JSON.stringify({
    v: 1,
    iv: bytesToBase64(iv),
    ct: bytesToBase64(new Uint8Array(ctBuf)),
  })
}

/**
 * Decrypt the envelope string written by `encryptValue`. Returns the parsed
 * plaintext value, or throws on auth/parse failure.
 *
 * If `str` is legacy plaintext JSON (no envelope), returns the parsed JSON so we
 * can migrate older installs transparently.
 */
export async function decryptEnvelopeString(str, cryptoKey) {
  if (typeof str !== 'string' || !str.length) return null
  let parsed
  try {
    parsed = JSON.parse(str)
  } catch {
    return null
  }

  // Unencrypted fallback for browsers without WebCrypto.
  if (parsed && typeof parsed === 'object' && parsed.v === 0) {
    return parsed.raw ?? null
  }

  // Legacy plaintext blobs: anything that isn't shaped like an envelope we
  // treat as plaintext and return as-is. The caller is responsible for
  // re-encrypting on the next write.
  if (!parsed || typeof parsed !== 'object' || parsed.v !== 1 || !parsed.iv || !parsed.ct) {
    return parsed
  }

  const iv = base64ToBytes(parsed.iv)
  const ct = base64ToBytes(parsed.ct)
  const ptBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ct,
  )
  const text = new TextDecoder().decode(ptBuf)
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

/** True if the string looks like one of our v=1 envelopes. */
export function looksEncrypted(str) {
  if (typeof str !== 'string' || str.length < 30) return false
  try {
    const p = JSON.parse(str)
    return p && p.v === 1 && typeof p.iv === 'string' && typeof p.ct === 'string'
  } catch {
    return false
  }
}
