import {
  getGeofences,
  getGeofenceState,
  saveGeofenceState,
  pushAnomaly,
} from './storage'
import { notify, isSupported as notificationsSupported, getPermission as getNotificationPermission } from './notifications'

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

export function isGeolocationSupported() {
  return typeof navigator !== 'undefined' && !!navigator.geolocation
}

export function isNotificationSupported() {
  return notificationsSupported()
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
      events.push({ fence, direction: inside ? 'enter' : 'leave', distance })
    }
  }

  saveGeofenceState(state)
  return events
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

function fireReminder({ fence, direction }) {
  const enter = direction === 'enter'
  const title = enter
    ? `Heading into ${fence.label}?`
    : `Leaving ${fence.label}?`
  const body = enter
    ? 'Clock in and log your shift start in ShiftGuard so your paycheck math stays accurate.'
    : 'Log your clock-out time in ShiftGuard so the next paycheck check catches any shortfalls.'

  // Fire a browser notification if we can.
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

  // Always record in-app so there's a breadcrumb even without OS notifications.
  pushAnomaly({
    severity: enter ? 'info' : 'warn',
    title,
    detail: `${body} (Geofence: ${fence.label}, direction: ${direction}).`,
    context: { type: 'geofence', fenceId: fence.id, direction },
  })
}
