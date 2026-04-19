/**
 * Lightweight client-side accounts.
 *
 * Honest about its limits: this is a profile + namespacing system, not real
 * authentication. Passwords are hashed with SubtleCrypto (SHA-256 + per-account salt) so
 * they're not stored in plaintext, but anyone with browser access can still read the
 * account index. We surface that in the UI.
 *
 * Public model:
 *   - One ACCOUNT INDEX at `shiftguard_accounts_v1`
 *       [{ id, email, displayName, salt, hash, createdAt, lastLoginAt, settings }]
 *   - One pointer at `shiftguard_active_account_id` -> id (or 'guest')
 *   - Every other read/write is namespaced by `getActiveScope()` which returns
 *       `account_${id}_` so storage.js prepends it transparently.
 *
 * Settings on the account record carry per-account preferences that should NOT live in
 * scoped storage (e.g. notification opt-ins that should survive logout/login).
 */

import {
  deriveRawKeyFromPassword,
  setSessionRawKey,
  getSessionRawKey,
  clearSessionRawKey,
  getOrCreateGuestDeviceKey,
} from './cryptoBox'
import {
  bootstrap as secureBootstrap,
  migrateLegacyPlaintext,
  lock as secureLock,
} from './secureStore'

const ACCOUNTS_KEY = 'shiftguard_accounts_v1'
const ACTIVE_KEY = 'shiftguard_active_account_id'
const GUEST_ID = 'guest'
const SCOPE_PREFIX = 'account_'

function safeRead(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.error('[accounts] Storage write failed.', err)
  }
}

function notifyAccountChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('shiftguard-account-changed'))
    window.dispatchEvent(new CustomEvent('shiftguard-data-changed'))
  }
}

/* -------------------------------------------------------------------------- */
/*  Hashing                                                                     */
/* -------------------------------------------------------------------------- */

function randomBytes(n = 16) {
  const arr = new Uint8Array(n)
  crypto.getRandomValues(arr)
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/* -------------------------------------------------------------------------- */
/*  Index                                                                       */
/* -------------------------------------------------------------------------- */

function readIndex() {
  const list = safeRead(ACCOUNTS_KEY)
  return Array.isArray(list) ? list : []
}

function writeIndex(list) {
  safeWrite(ACCOUNTS_KEY, list)
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

export function listAccounts() {
  // Strip out hash + salt before exposing accounts to the UI.
  return readIndex().map(a => {
    const safe = { ...a }
    delete safe.hash
    delete safe.salt
    return safe
  })
}

export function getActiveAccountId() {
  return localStorage.getItem(ACTIVE_KEY) || GUEST_ID
}

export function getActiveAccount() {
  const id = getActiveAccountId()
  if (id === GUEST_ID) return null
  const acct = readIndex().find(a => a.id === id)
  if (!acct) return null
  const safe = { ...acct }
  delete safe.hash
  delete safe.salt
  return safe
}

/** Returns the storage prefix the rest of the app should prepend. */
export function getActiveScope() {
  return `${SCOPE_PREFIX}${getActiveAccountId()}_`
}

/**
 * Switch the active account pointer. Pass `{ skipUnlock: true }` from sign-in
 * and sign-up flows (they handle the bootstrap themselves); otherwise the
 * pointer change also tears down the secure cache so a subsequent
 * rehydrateSecureStore() boots cleanly.
 */
export function setActiveAccount(id, { skipUnlock = false } = {}) {
  localStorage.setItem(ACTIVE_KEY, id || GUEST_ID)
  if (!skipUnlock) {
    secureLock()
    clearSessionRawKey()
  }
  notifyAccountChanged()
}

export function logout() {
  secureLock()
  clearSessionRawKey()
  localStorage.setItem(ACTIVE_KEY, GUEST_ID)
  notifyAccountChanged()
  // Immediately re-bootstrap as guest so the app isn't stuck in a locked
  // state. Guest has a device key on disk so this is synchronous in effect.
  const rawKey = getOrCreateGuestDeviceKey()
  setSessionRawKey(rawKey)
  const scope = `${SCOPE_PREFIX}${GUEST_ID}_`
  secureBootstrap(scope, rawKey).then(() => notifyAccountChanged())
}

/* -------------------------------------------------------------------------- */
/*  Sign up / sign in                                                           */
/* -------------------------------------------------------------------------- */

export async function signUp({ email, password, displayName }) {
  const cleanEmail = normalizeEmail(email)
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Enter a valid email address.')
  }
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
  const index = readIndex()
  if (index.some(a => a.email === cleanEmail)) {
    throw new Error('An account with that email already exists on this device.')
  }
  const salt = randomBytes()
  const hash = await hashPassword(password, salt)
  const dataSalt = randomBytes(32) // distinct salt for the AES-GCM key derivation
  const id = `acct_${Date.now()}_${randomBytes(4)}`
  const account = {
    id,
    email: cleanEmail,
    displayName: String(displayName || cleanEmail.split('@')[0] || 'New user').trim(),
    salt,
    hash,
    dataSalt,
    keyVersion: 1,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    settings: { notifications: { geofence: true, dailySummary: true }, autoTrackShifts: true },
  }
  writeIndex([...index, account])
  setActiveAccount(id, { skipUnlock: true })

  // Derive + cache the data key, bootstrap the secure store against the new
  // (empty) scope. This gives the new account an encrypted store from the
  // first write onward.
  const rawKey = await deriveRawKeyFromPassword(password, dataSalt)
  setSessionRawKey(rawKey)
  const scope = `${SCOPE_PREFIX}${id}_`
  await secureBootstrap(scope, rawKey)
  await migrateLegacyPlaintext()

  notifyAccountChanged()
  return getActiveAccount()
}

export async function signIn({ email, password }) {
  const cleanEmail = normalizeEmail(email)
  const index = readIndex()
  const acct = index.find(a => a.email === cleanEmail)
  if (!acct) throw new Error('No account found for that email on this device.')
  const computed = await hashPassword(password, acct.salt)
  if (computed !== acct.hash) throw new Error('That password does not match.')

  // Backfill dataSalt for accounts created before the crypto rollout. Legacy
  // plaintext blobs get rewrapped into AES-GCM on the first write after
  // bootstrap via migrateLegacyPlaintext().
  let dataSalt = acct.dataSalt
  if (!dataSalt) {
    dataSalt = randomBytes(32)
  }
  const updated = {
    ...acct,
    dataSalt,
    keyVersion: acct.keyVersion || 1,
    lastLoginAt: new Date().toISOString(),
  }
  writeIndex(index.map(a => (a.id === acct.id ? updated : a)))
  setActiveAccount(acct.id, { skipUnlock: true })

  const rawKey = await deriveRawKeyFromPassword(password, dataSalt)
  setSessionRawKey(rawKey)
  const scope = `${SCOPE_PREFIX}${acct.id}_`
  const result = await secureBootstrap(scope, rawKey)
  if (!result.ok) {
    // Wrong key / corrupt ciphertext. Keep the session key so the app can show
    // a clear locked-state UI instead of failing silently.
    throw new Error('Your password unlocks the account but the encrypted data on this device could not be decrypted. If you recently changed devices or wiped data, sign out and sign back in to re-seed the vault.')
  }
  await migrateLegacyPlaintext()

  notifyAccountChanged()
  return getActiveAccount()
}

export function continueAsGuest() {
  setActiveAccount(GUEST_ID, { skipUnlock: true })
  // Load (or seed) the device-local guest key and unlock immediately.
  const rawKey = getOrCreateGuestDeviceKey()
  setSessionRawKey(rawKey)
  const scope = `${SCOPE_PREFIX}${GUEST_ID}_`
  secureBootstrap(scope, rawKey).then(async (res) => {
    if (res.ok) {
      await migrateLegacyPlaintext()
      notifyAccountChanged()
    }
  })
}

export function deleteAccount(id) {
  const index = readIndex().filter(a => a.id !== id)
  writeIndex(index)
  if (getActiveAccountId() === id) {
    secureLock()
    clearSessionRawKey()
    setActiveAccount(GUEST_ID)
  }
}

/**
 * Re-bootstrap the secure store from the session-stored raw key. Called at app
 * startup after a page reload: sessionStorage survives F5 so the user stays
 * unlocked without re-typing their password. Returns:
 *
 *   { state: 'unlocked' }                  — all good, cache is populated
 *   { state: 'guest-unlocked' }            — guest was auto-unlocked with the device key
 *   { state: 'locked', reason: '...' }     — no session key; UI should surface sign-in
 *
 * Never throws. The app always renders.
 */
export async function rehydrateSecureStore() {
  const id = getActiveAccountId()
  const scope = `${SCOPE_PREFIX}${id}_`

  if (id === GUEST_ID) {
    const rawKey = getOrCreateGuestDeviceKey()
    setSessionRawKey(rawKey)
    const res = await secureBootstrap(scope, rawKey)
    if (res.ok) await migrateLegacyPlaintext()
    return { state: 'guest-unlocked', ok: res.ok }
  }

  const session = getSessionRawKey()
  if (session && session.length >= 32) {
    const res = await secureBootstrap(scope, session)
    if (res.ok) {
      await migrateLegacyPlaintext()
      return { state: 'unlocked' }
    }
    // Key did not decrypt — the account was probably signed out in another
    // tab. Force-lock so the UI prompts for sign-in.
    clearSessionRawKey()
    secureLock()
    return { state: 'locked', reason: 'session-key-invalid' }
  }
  secureLock()
  return { state: 'locked', reason: 'no-session-key' }
}

/* -------------------------------------------------------------------------- */
/*  Per-account settings (notifications, autotrack)                              */
/* -------------------------------------------------------------------------- */

const DEFAULT_SETTINGS = {
  notifications: { geofence: true, dailySummary: true },
  autoTrackShifts: true,
}

export function getAccountSettings() {
  const acct = getActiveAccount()
  if (!acct) return DEFAULT_SETTINGS
  const index = readIndex()
  const full = index.find(a => a.id === acct.id)
  return { ...DEFAULT_SETTINGS, ...(full?.settings || {}) }
}

export function saveAccountSettings(patch) {
  const acct = getActiveAccount()
  if (!acct) return DEFAULT_SETTINGS
  const index = readIndex()
  const next = index.map(a => {
    if (a.id !== acct.id) return a
    const merged = { ...DEFAULT_SETTINGS, ...(a.settings || {}), ...patch }
    return { ...a, settings: merged }
  })
  writeIndex(next)
  notifyAccountChanged()
  return { ...DEFAULT_SETTINGS, ...(next.find(a => a.id === acct.id)?.settings || {}) }
}

/** True when the active account is anything other than 'guest'. */
export function isLoggedIn() {
  return getActiveAccountId() !== GUEST_ID
}

export const GUEST_ACCOUNT_ID = GUEST_ID
