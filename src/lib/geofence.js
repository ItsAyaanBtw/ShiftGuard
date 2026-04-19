import {
  getGeofences,
  getGeofenceState,
  saveGeofenceState,
  pushAnomaly,
  getPaystub,
  getShifts,
  saveShifts,
} from './storage'
import { notify, isSupported as notificationsSupported, getPermission as getNotificationPermission } from './notifications'
import { getAccountSettings } from './accounts'

/**
 * Client-side geofence runtime.
 *
 * What this supports:
 *   - `isGeolocationSupported()` / `isNotificationSupported()` feature detection.
 *   - `requestGeolocationPermission()` one-shot prompt (the browser asks).
 *   - `startGeofenceWatcher({ onChange })` starts a long-running watchPosition loop that
 *     compares the user's current coordinates against every saved fence and fires
 *     browser Notifications on enter/leave, with per-fence debounce so users at the edge
 *     aren't spammed.
 *
 * What this does NOT do:
 *   - Background tracking. Web apps cannot run geolocation when the tab is closed or the
 *     screen is off without a PWA + service worker + periodic sync, which is out of scope.
 *     The geofence watcher runs while the ShiftGuard tab is open.
 *
 * Privacy model:
 *   - Fences are stored in localStorage only.
 *   - Coordinates are only used in-memory to compute distance; we never send them off
 *     device.
 */

const NOTIFICATION_DEBOUNCE_MS = 5 * 60 * 1000 // 5 minutes per fence direction
const WATCHER_PREF_KEY = 'shiftguard_geofence_watcher_enabled'

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation
}

export function isNotificationSupported() {
  return notificationsSupported()
}

/**
 * Cross-browser permission probe via the Permissions API. Returns one of
 * 'granted' | 'denied' | 'prompt' | 'unsupported'. Safari has historically
 * lacked permissions.query for geolocation, so we fall back to 'prompt' there.
 */
export async function queryGeolocationPermission() {
  if (!isGeolocationSupported()) return 'unsupported'
  if (typeof navigator.permissions?.query !== 'function') return 'prompt'
  try {
    const res = await navigator.permissions.query({ name: 'geolocation' })
    return res.state || 'prompt'
  } catch {
    return 'prompt'
  }
}

export function isWatcherPreferenceEnabled() {
  try {
    return localStorage.getItem(WATCHER_PREF_KEY) === '1'
  } catch {
    return false
  }
}

export function setWatcherPreference(on) {
  try {
    if (on) localStorage.setItem(WATCHER_PREF_KEY, '1')
    else localStorage.removeItem(WATCHER_PREF_KEY)
  } catch {
    /* noop */
  }
}

export async function requestGeolocationPermission() {
  // The browser only prompts on the first getCurrentPosition call; there's no separate
  // `permissions.request` API for geolocation in every browser, so we trigger a one-shot
  // location read and surface the result.
  if (!isGeolocationSupported()) return 'unsupported'
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      err => {
        if (err.code === err.PERMISSION_DENIED) resolve('denied')
        else resolve('unavailable')
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    )
  })
}

/** Current lat/lng one-shot, as { lat, lng, accuracy }. Rejects on denial. */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!isGeolocationSupported()) return reject(new Error('Geolocation not supported'))
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    )
  })
}

/** Haversine distance in meters. */
export function distanceMeters(a, b) {
  if (!a || !b) return Infinity
  const R = 6371_000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const aa = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
  return R * c
}

/**
 * Process one position sample against every saved fence. Updates persisted state and
 * fires a notification on the first enter or leave per debounce window.
 *
 * Returns a list of events fired this tick: { fence, direction: 'enter' | 'leave' }.
 */
export function evaluateFences(position, { now = Date.now() } = {}) {
  if (!position) return []
  const fences = getGeofences()
  if (!fences.length) return []

  const state = getGeofenceState()
  const events = []

  for (const fence of fences) {
    if (!Number.isFinite(fence.lat) || !Number.isFinite(fence.lng)) continue
    const distance = distanceMeters(position, fence)
    const inside = distance <= (fence.radiusM || 200)
    const prev = state[fence.id] || { inside: false, since: null, lastNotifiedAt: 0 }

    if (prev.inside === inside) {
      // No state change, nothing to emit.
      state[fence.id] = { ...prev }
      continue
    }

    state[fence.id] = {
      inside,
      since: new Date(now).toISOString(),
      lastNotifiedAt: prev.lastNotifiedAt || 0,
    }

    const sinceLastNotify = now - (prev.lastNotifiedAt || 0)
    const shouldNotify = (inside && fence.remindOnEnter !== false)
      || (!inside && fence.remindOnLeave !== false)
    if (shouldNotify && sinceLastNotify > NOTIFICATION_DEBOUNCE_MS) {
      state[fence.id].lastNotifiedAt = now
      const event = {
        fence,
        direction: inside ? 'enter' : 'leave',
        distance,
        enterIso: !inside ? prev.since : state[fence.id].since,
        leaveIso: !inside ? state[fence.id].since : null,
      }
      if (!inside && prev.since) {
        event.summary = summarizeShift({ enterIso: prev.since, leaveIso: state[fence.id].since })
      }
      events.push(event)
    }
  }

  saveGeofenceState(state)
  return events
}

function summarizeShift({ enterIso, leaveIso }) {
  const enter = new Date(enterIso)
  const leave = new Date(leaveIso)
  if (Number.isNaN(enter.valueOf()) || Number.isNaN(leave.valueOf())) return null
  const minutes = Math.max(0, Math.round((leave - enter) / 60000))
  if (minutes < 5) return null
  const hours = minutes / 60
  const paystub = getPaystub()
  const rate = Number(paystub?.hourly_rate) || 0
  const estimatedEarned = rate > 0 ? hours * rate : null

  // Daily total: sum hours from any shifts already logged for the calendar day plus the
  // shift that just ended. Lets us include "you worked X hours today, took home about $Y"
  // in the leave notification when the user works split shifts.
  const dayKey = leave.toISOString().slice(0, 10)
  const dayShifts = getShifts().filter(s => s.date === dayKey)
  let priorMinutesToday = 0
  for (const s of dayShifts) {
    const [h1, m1] = (s.clockIn || '0:0').split(':').map(Number)
    const [h2, m2] = (s.clockOut || '0:0').split(':').map(Number)
    if (![h1, m1, h2, m2].every(Number.isFinite)) continue
    const start = h1 * 60 + m1
    const end = h2 * 60 + m2
    let span = end - start
    if (span <= 0) span += 24 * 60 // overnight
    span -= Math.max(0, Number(s.breakMinutes) || 0)
    priorMinutesToday += Math.max(0, span)
  }
  const totalMinutesToday = priorMinutesToday + minutes
  const totalHoursToday = totalMinutesToday / 60
  const dayEarnedTotal = rate > 0 ? totalHoursToday * rate : null

  return {
    hours: Number(hours.toFixed(2)),
    minutes,
    rate,
    estimatedEarned: estimatedEarned != null ? Number(estimatedEarned.toFixed(2)) : null,
    totalHoursToday: Number(totalHoursToday.toFixed(2)),
    dayEarnedTotal: dayEarnedTotal != null ? Number(dayEarnedTotal.toFixed(2)) : null,
  }
}

/**
 * Append a shift record reconstructed from the geofence enter/leave timestamps. Idempotent
 * by externalId so repeat events for the same window don't duplicate the entry.
 */
function autoCreateShiftFromGeofence({ fence, summary, enterIso, leaveIso }) {
  if (!summary || summary.minutes < 30) return null
  const enter = new Date(enterIso)
  const leave = new Date(leaveIso)
  const dateKey = enter.toISOString().slice(0, 10)
  const externalId = `geofence-${fence.id}-${enterIso}`
  const shifts = getShifts()
  if (shifts.some(s => s.externalId === externalId)) return null

  const draft = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `shift-${Date.now()}`,
    date: dateKey,
    clockIn: enter.toTimeString().slice(0, 5),
    clockOut: leave.toTimeString().slice(0, 5),
    breakMinutes: 0,
    tips: 0,
    flaggedOT: false,
    shiftType: 'day',
    isWeekend: [0, 6].includes(enter.getDay()),
    isHoliday: false,
    chargeNurse: false,
    preceptor: false,
    onCallHours: 0,
    milesDriven: 0,
    reimbursementRate: 0.67,
    source: 'geofence',
    externalId,
    employer: fence.linkedEmployer || fence.label || '',
    importLabel: `Auto-logged from ${fence.label || 'geofence'}`,
  }
  saveShifts([...shifts, draft])
  return draft
}

/**
 * Start the watchPosition loop. Returns a stop function the caller should invoke on
 * component unmount.
 *
 * `onChange` fires on every processed sample, `onEvent` fires only on enter/leave edges
 * that passed the debounce filter.
 */
export function startGeofenceWatcher({ onChange, onEvent } = {}) {
  if (!isGeolocationSupported()) return () => {}

  const watchId = navigator.geolocation.watchPosition(
    pos => {
      const sample = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: new Date().toISOString(),
      }
      const events = evaluateFences(sample)
      if (typeof onChange === 'function') onChange(sample)
      if (events.length && typeof onEvent === 'function') {
        for (const e of events) onEvent(e)
      }
      for (const e of events) fireReminder(e)
    },
    () => {
      // Silently stop on error; the UI is responsible for surfacing permission issues.
    },
    { enableHighAccuracy: true, maximumAge: 60_000, timeout: 30_000 },
  )

  return function stop() {
    try { navigator.geolocation.clearWatch(watchId) } catch { /* noop */ }
  }
}

function fireReminder({ fence, direction, summary, enterIso, leaveIso }) {
  const enter = direction === 'enter'
  const settings = getAccountSettings()
  if (!settings?.notifications?.geofence) return

  // Optionally auto-log the shift the user just finished. Only on leave events with
  // valid summary metadata, and only when the account opted in.
  let autoShift = null
  if (!enter && summary && settings.autoTrackShifts !== false) {
    autoShift = autoCreateShiftFromGeofence({ fence, summary, enterIso, leaveIso })
  }

  const title = enter
    ? `Heading into ${fence.label}?`
    : `Wrapping up at ${fence.label}?`

  let body
  if (enter) {
    body = 'Clock in and log your shift start in ShiftGuard so your paycheck math stays accurate.'
  } else if (summary) {
    const hrsLabel = summary.hours >= 1 ? `${summary.hours.toFixed(2)}h` : `${summary.minutes}m`
    const earnBit = summary.estimatedEarned != null
      ? `About $${summary.estimatedEarned.toFixed(2)} earned at $${summary.rate.toFixed(2)}/h.`
      : 'Add your hourly rate in the Pay stub tab to see estimated earnings here.'

    let dailyBit = ''
    if (settings?.notifications?.dailySummary && summary.totalHoursToday > summary.hours + 0.01) {
      dailyBit = ` Today\u2019s total: ${summary.totalHoursToday.toFixed(2)}h${
        summary.dayEarnedTotal != null ? ` (~$${summary.dayEarnedTotal.toFixed(2)})` : ''
      }.`
    }

    body = `You were inside for ${hrsLabel}. ${earnBit}${dailyBit}${
      autoShift ? ' Auto-logged to your shift list.' : ' Log the clock-out when you can.'
    }`
  } else {
    body = 'Log your clock-out time in ShiftGuard so the next paycheck check catches any shortfalls.'
  }

  if (getNotificationPermission() === 'granted') {
    notify(title, {
      body,
      tag: `geofence-${fence.id}-${direction}`,
      requireInteraction: false,
      onClick: () => {
        try { window.location.assign('/log') } catch { /* noop */ }
      },
    })
  }

  pushAnomaly({
    severity: enter ? 'info' : 'warn',
    title,
    detail: `${body} (Geofence: ${fence.label}, direction: ${direction}).`,
    context: {
      type: 'geofence',
      fenceId: fence.id,
      direction,
      autoShiftId: autoShift?.id || null,
      ...(summary || {}),
    },
  })
}

/**
 * Fire a test enter+leave pair for a single fence without touching geolocation.
 * Useful for the "Test this fence" button so users can confirm their
 * notification and auto-log wiring without walking to the worksite.
 *
 * Simulates an enter 65 minutes ago and a leave now, so the fake shift summary
 * looks like a real hour-plus shift.
 */
export function simulateFenceVisit(fence) {
  if (!fence) return
  const now = Date.now()
  const enterIso = new Date(now - 65 * 60_000).toISOString()
  const leaveIso = new Date(now).toISOString()
  const summary = summarizeShift({ enterIso, leaveIso })
  // Fire the leave event directly (enter is implicit in the summary window).
  fireReminder({
    fence,
    direction: 'leave',
    summary,
    enterIso,
    leaveIso,
    distance: 0,
  })
}
