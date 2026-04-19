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

export function setActiveAccount(id) {
  localStorage.setItem(ACTIVE_KEY, id || GUEST_ID)
  notifyAccountChanged()
}

export function logout() {
  setActiveAccount(GUEST_ID)
}

/* -------------------------------------------------------------------------- */
/*  Sign up / sign in                                                           */
/* -------------------------------------------------------------------------- */

export async function signUp({ email, password, displayName }) {
  const cleanEmail = normalizeEmail(email)
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Enter a valid email address.')
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }
  const index = readIndex()
  if (index.some(a => a.email === cleanEmail)) {
    throw new Error('An account with that email already exists on this device.')
  }
  const salt = randomBytes()
  const hash = await hashPassword(password, salt)
  const id = `acct_${Date.now()}_${randomBytes(4)}`
  const account = {
    id,
    email: cleanEmail,
    displayName: String(displayName || cleanEmail.split('@')[0] || 'New user').trim(),
    salt,
    hash,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    settings: { notifications: { geofence: true, dailySummary: true }, autoTrackShifts: true },
  }
  writeIndex([...index, account])
  setActiveAccount(id)
  return getActiveAccount()
}

export async function signIn({ email, password }) {
  const cleanEmail = normalizeEmail(email)
  const index = readIndex()
  const acct = index.find(a => a.email === cleanEmail)
  if (!acct) throw new Error('No account found for that email on this device.')
  const computed = await hashPassword(password, acct.salt)
  if (computed !== acct.hash) throw new Error('That password does not match.')
  const updated = { ...acct, lastLoginAt: new Date().toISOString() }
  writeIndex(index.map(a => (a.id === acct.id ? updated : a)))
  setActiveAccount(acct.id)
  return getActiveAccount()
}

export function continueAsGuest() {
  setActiveAccount(GUEST_ID)
}

export function deleteAccount(id) {
  const index = readIndex().filter(a => a.id !== id)
  writeIndex(index)
  if (getActiveAccountId() === id) setActiveAccount(GUEST_ID)
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
