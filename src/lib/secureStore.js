/**
 * secureStore — the bridge between the app's synchronous storage API and the
 * asynchronous SubtleCrypto world.
 *
 * Shape of the bridge:
 *   1. `bootstrap(scope, rawKeyBytes)` runs ONCE after sign-in (or on page load
 *      when a session key exists). It decrypts every known sensitive key for
 *      this scope into an in-memory cache.
 *   2. `readSync(scopedKey)` returns the plaintext value from cache. Encrypted
 *      keys that have not been bootstrapped return `null` (treated as
 *      "locked"). Non-sensitive keys continue to read directly from
 *      localStorage via the existing storage.js paths.
 *   3. `writeSync(scopedKey, value)` updates the cache immediately so the UI
 *      is consistent, and enqueues an async encrypt-and-persist. Writes are
 *      serialized per key so rapid updates don't race.
 *
 * Why not async-everywhere? The existing storage API (getPaystub(), getShifts()
 * etc.) is pervasively synchronous across ~40 call sites. Converting all of
 * those to `await` is risky and noisy for a hackathon-scale codebase. The cache
 * sidecar keeps the API stable while moving the durable medium to ciphertext.
 */

import {
  hasWebCrypto,
  importAesKey,
  encryptValue,
  decryptEnvelopeString,
  looksEncrypted,
} from './cryptoBox'

/**
 * List of storage keys (un-scoped) that we treat as sensitive. Anything in this
 * list is written as AES-GCM ciphertext on disk. Everything else (preferences,
 * subscription tier, onboarding flags, UI dismissals, geofences, anomalies
 * metadata) stays as plaintext JSON because it contains no PII and needs to be
 * readable synchronously at boot.
 */
export const SENSITIVE_KEYS = new Set([
  'shiftguard_shifts',
  'shiftguard_paystub',
  'shiftguard_paystub_image',
  'shiftguard_vault',
  'shiftguard_timesheet',
  'shiftguard_verification_history',
  'shiftguard_verified_paycheck_keys',
  'shiftguard_violations',
  'shiftguard_documents',
])

/** True when a given scoped key maps to one of the sensitive keys above. */
export function isSensitiveScoped(scopedKey) {
  for (const k of SENSITIVE_KEYS) {
    if (typeof scopedKey === 'string' && scopedKey.endsWith(k)) return true
  }
  return false
}

/* ------------------------------ internal state ----------------------------- */

let state = {
  // Decrypted in-memory mirror of sensitive keys for the active scope.
  cache: new Map(),
  // The actual AES-GCM CryptoKey in use, scoped per bootstrap.
  cryptoKey: null,
  // Scope prefix the current bootstrap belongs to (e.g. 'account_guest_').
  scope: '',
  // A bumpable version so callers can react to unlock state changes.
  unlockVersion: 0,
  // Promise tracker for in-flight writes per scoped key, so we don't race.
  writeQueue: new Map(),
}

function onChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shiftguard-data-changed'))
    window.dispatchEvent(new CustomEvent('shiftguard-secure-unlocked'))
  }
}

export function isUnlocked() {
  return !!state.cryptoKey
}

export function getUnlockScope() {
  return state.scope
}

export function getUnlockVersion() {
  return state.unlockVersion
}

/* ------------------------------ bootstrap flow ----------------------------- */

/**
 * Decrypt every sensitive key for `scope` using `rawKeyBytes` and populate the
 * in-memory cache. Any key that's legacy plaintext gets re-encrypted on the
 * next write.
 *
 * Returns { ok: true } on success, { ok: false, error } on any failure. A
 * failure means the key is wrong; the caller should prompt the user to
 * re-authenticate.
 */
export async function bootstrap(scope, rawKeyBytes) {
  if (!scope) return { ok: false, error: 'no scope' }
  if (!rawKeyBytes || rawKeyBytes.length < 32) {
    return { ok: false, error: 'invalid key' }
  }
  if (!hasWebCrypto()) {
    // Fall back to plaintext mode with no cache wiring. Downstream writes will
    // go through encryptValue()'s v=0 envelope so data still lands on disk.
    state = {
      cache: new Map(),
      cryptoKey: null,
      scope,
      unlockVersion: state.unlockVersion + 1,
      writeQueue: new Map(),
    }
    onChange()
    return { ok: true, legacy: true }
  }

  let cryptoKey
  try {
    cryptoKey = await importAesKey(rawKeyBytes)
  } catch (err) {
    return { ok: false, error: err.message || 'key import failed' }
  }

  const cache = new Map()
  // Load every sensitive key under the scope. Legacy plaintext blobs pass
  // through via decryptEnvelopeString's v=0/raw fallback. Any ciphertext that
  // fails to decrypt (wrong key) aborts the whole unlock so we never serve
  // stale data from another account.
  for (const k of SENSITIVE_KEYS) {
    const scopedKey = `${scope}${k}`
    let raw
    try {
      raw = localStorage.getItem(scopedKey)
    } catch {
      raw = null
    }
    if (raw == null) continue
    if (!looksEncrypted(raw)) {
      // Legacy plaintext: decryptEnvelopeString handles non-envelope JSON.
      try {
        const value = await decryptEnvelopeString(raw, cryptoKey)
        cache.set(scopedKey, value)
      } catch {
        cache.set(scopedKey, null)
      }
      continue
    }
    try {
      const value = await decryptEnvelopeString(raw, cryptoKey)
      cache.set(scopedKey, value)
    } catch {
      return { ok: false, error: 'decrypt_failed', scopedKey }
    }
  }

  state = {
    cache,
    cryptoKey,
    scope,
    unlockVersion: state.unlockVersion + 1,
    writeQueue: new Map(),
  }
  onChange()
  return { ok: true }
}

/**
 * Re-encrypt any legacy plaintext blobs currently in the cache. Called after
 * a successful bootstrap so the first write doesn't have to carry that load.
 */
export async function migrateLegacyPlaintext() {
  if (!state.cryptoKey) return
  for (const [scopedKey, value] of state.cache.entries()) {
    try {
      const raw = localStorage.getItem(scopedKey)
      if (raw == null) continue
      if (looksEncrypted(raw)) continue
      const envelope = await encryptValue(value, state.cryptoKey)
      localStorage.setItem(scopedKey, envelope)
    } catch {
      // Ignore, the cache still has the plaintext and future writes will
      // re-encrypt.
    }
  }
}

/**
 * Drop the in-memory key + cache. Called on logout or account switch. After
 * this, sensitive keys read as `null` until the next bootstrap succeeds.
 */
export function lock() {
  state = {
    cache: new Map(),
    cryptoKey: null,
    scope: '',
    unlockVersion: state.unlockVersion + 1,
    writeQueue: new Map(),
  }
  onChange()
}

/* ------------------------------ sync read/write ---------------------------- */

/** Scoped key read. Returns null if locked or if key is absent. */
export function readSync(scopedKey) {
  if (!isSensitiveScoped(scopedKey)) return undefined // caller should fall back to localStorage
  if (!state.cache.has(scopedKey)) return null
  return state.cache.get(scopedKey)
}

/**
 * Scoped key write. Updates the cache immediately, then fires an async encrypt
 * + persist. We don't await the persist — the caller gets sync semantics — but
 * we DO serialize writes per key to keep on-disk ordering stable.
 */
export function writeSync(scopedKey, value) {
  if (!isSensitiveScoped(scopedKey)) return false // caller handles plaintext path

  // Always keep the cache hot even when locked, so a caller that bootstraps
  // later doesn't lose the intended value. If there's no cryptoKey we fall
  // through to plaintext persistence (which only happens pre-bootstrap or on
  // legacy browsers via encryptValue's v=0 envelope).
  state.cache.set(scopedKey, value)

  const prior = state.writeQueue.get(scopedKey) || Promise.resolve()
  const next = prior.then(async () => {
    try {
      const envelope = state.cryptoKey
        ? await encryptValue(value, state.cryptoKey)
        : await encryptValue(value, null)
      localStorage.setItem(scopedKey, envelope)
    } catch (err) {
      console.error('[secureStore] persist failed', err)
    }
  })
  state.writeQueue.set(scopedKey, next)
  return true
}

/** Scoped key removal. */
export function removeSync(scopedKey) {
  if (!isSensitiveScoped(scopedKey)) return false
  state.cache.delete(scopedKey)
  try {
    localStorage.removeItem(scopedKey)
  } catch {
    /* noop */
  }
  return true
}

/** Debug: count of keys currently decrypted + in memory. */
export function cacheSize() {
  return state.cache.size
}
