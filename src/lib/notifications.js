/**
 * Thin wrapper around the browser Notification API with a permission flow.
 *
 * Notifications require HTTPS in production; on `localhost` they work over http too. On
 * iOS Safari, notifications only fire when the app is installed to the home screen (PWA).
 * The caller should degrade gracefully if `isSupported()` returns false.
 */

export function isSupported() {
  return typeof window !== 'undefined'
    && typeof window.Notification !== 'undefined'
    && typeof window.Notification.requestPermission === 'function'
}

export function getPermission() {
  if (!isSupported()) return 'unsupported'
  return Notification.permission  // 'default' | 'granted' | 'denied'
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'denied'
  }
}

export function notify(title, { body = '', tag = '', requireInteraction = false, onClick } = {}) {
  if (!isSupported() || getPermission() !== 'granted') return null
  try {
    const n = new Notification(title, {
      body,
      tag: tag || undefined,
      requireInteraction,
      silent: false,
    })
    if (typeof onClick === 'function') {
      n.onclick = e => {
        e.preventDefault()
        try { window.focus() } catch { /* noop */ }
        onClick()
        n.close()
      }
    }
    return n
  } catch {
    return null
  }
}
