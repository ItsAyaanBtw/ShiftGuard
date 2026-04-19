import { useEffect, useReducer, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MapPin, Crosshair, Bell, BellOff, Trash2, CheckCircle2, AlertCircle, Loader2,
  ArrowRight,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import {
  getGeofences, saveGeofence, removeGeofence,
} from '../lib/storage'
import {
  isGeolocationSupported, isNotificationSupported,
  requestGeolocationPermission, getCurrentPosition, startGeofenceWatcher,
} from '../lib/geofence'
import {
  getPermission as getNotificationPermission, requestPermission as requestNotifPermission,
} from '../lib/notifications'

/**
 * Geofence manager. Lets a worker drop pins on their worksites so ShiftGuard can nudge
 * them to log a clock-in when they arrive and a clock-out when they leave.
 *
 * The watcher runs only while this tab is open; that's an honest limitation of browser
 * geolocation without a service worker. When the tab is closed, the reminder stops.
 *
 * Nothing here calls out to any mapping or geocoding API. The user either taps "Use my
 * current location" (navigator.geolocation), or types lat/lng manually.
 */

const DEFAULT_RADIUS = 200

export default function GeofenceScreen() {
  const [, bump] = useReducer(n => n + 1, 0)
  const [draft, setDraft] = useState(() => emptyDraft())
  const [posBusy, setPosBusy] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [watcherOn, setWatcherOn] = useState(false)

  useEffect(() => {
    const on = () => bump()
    window.addEventListener('shiftguard-data-changed', on)
    return () => window.removeEventListener('shiftguard-data-changed', on)
  }, [])

  useEffect(() => {
    if (!watcherOn) return
    const stop = startGeofenceWatcher({
      onEvent: (e) => setInfo(`${e.direction === 'enter' ? 'Entered' : 'Left'} ${e.fence.label}.`),
    })
    return stop
  }, [watcherOn])

  const fences = getGeofences()
  const geoSupported = isGeolocationSupported()
  const notifSupported = isNotificationSupported()
  const notifPermission = notifSupported ? getNotificationPermission() : 'unsupported'

  async function captureCurrent() {
    setErr(''); setInfo(''); setPosBusy(true)
    try {
      const permission = await requestGeolocationPermission()
      if (permission !== 'granted') {
        throw new Error('Location permission denied. You can still add a fence by typing the lat/lng manually.')
      }
      const pos = await getCurrentPosition()
      setDraft(d => ({ ...d, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) }))
    } catch (e) {
      setErr(e.message || 'Could not read location.')
    } finally {
      setPosBusy(false)
    }
  }

  async function enableNotifications() {
    setErr(''); setInfo('')
    const result = await requestNotifPermission()
    if (result === 'granted') setInfo('Notifications enabled. You\u2019ll see them when you cross a fence.')
    else if (result === 'denied') setErr('Notifications denied. Open your browser settings to re-enable.')
    else if (result === 'unsupported') setErr('This browser doesn\u2019t support web notifications.')
    bump()
  }

  function submit() {
    setErr(''); setInfo('')
    if (!draft.label.trim()) { setErr('Give the fence a label.'); return }
    const lat = Number(draft.lat); const lng = Number(draft.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { setErr('Lat/Lng must be numbers.'); return }
    saveGeofence({
      label: draft.label.trim(),
      lat, lng,
      radiusM: Math.max(25, Number(draft.radiusM) || DEFAULT_RADIUS),
      remindBeforeMin: Math.max(0, Number(draft.remindBeforeMin) || 0),
      remindOnEnter: draft.remindOnEnter,
      remindOnLeave: draft.remindOnLeave,
      linkedEmployer: draft.linkedEmployer.trim() || undefined,
    })
    setDraft(emptyDraft())
    setInfo('Fence saved.')
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta mb-3">
            <MapPin className="w-3.5 h-3.5" />
            Geofence reminders
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Remind me when I arrive at work
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mt-1">
            Drop a pin on each worksite. ShiftGuard pings you to clock in when you enter the fence and to
            clock out when you leave. Coordinates stay on your device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <Link to="/integrations" className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5 hover:border-slate-700">
              All integrations
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link to="/log" className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5 hover:border-slate-700">
              Shift logger
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
          <div className="md:col-span-3 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
            <h2 className="text-sm font-semibold text-white">Add a worksite fence</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-1 mb-4">
              Use your current location for accuracy, or paste lat/lng from Google Maps.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Label">
                  <input
                    type="text"
                    value={draft.label}
                    onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                    placeholder="Memorial Hermann SW"
                    className={inputCls}
                  />
                </Field>
                <Field label="Linked employer (optional)">
                  <input
                    type="text"
                    value={draft.linkedEmployer}
                    onChange={e => setDraft(d => ({ ...d, linkedEmployer: e.target.value }))}
                    placeholder="HCA"
                    className={inputCls}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="Latitude">
                  <input
                    type="number"
                    step="0.000001"
                    value={draft.lat}
                    onChange={e => setDraft(d => ({ ...d, lat: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    type="number"
                    step="0.000001"
                    value={draft.lng}
                    onChange={e => setDraft(d => ({ ...d, lng: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <Field label="Radius (meters)">
                  <input
                    type="number"
                    min="25"
                    value={draft.radiusM}
                    onChange={e => setDraft(d => ({ ...d, radiusM: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </div>

              <button
                type="button"
                onClick={captureCurrent}
                disabled={!geoSupported || posBusy}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-terracotta hover:text-terracotta-light px-3 py-1.5 rounded-lg border border-terracotta/40 hover:border-terracotta disabled:opacity-60"
              >
                {posBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                Use my current location
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-800">
                <Field label="Remind me this many minutes before a shift">
                  <input
                    type="number"
                    min="0"
                    value={draft.remindBeforeMin}
                    onChange={e => setDraft(d => ({ ...d, remindBeforeMin: e.target.value }))}
                    className={inputCls}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm text-slate-200 pt-6">
                  <input
                    type="checkbox"
                    checked={draft.remindOnEnter}
                    onChange={e => setDraft(d => ({ ...d, remindOnEnter: e.target.checked }))}
                    className="accent-terracotta"
                  />
                  Remind on arrival
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-200 pt-6">
                  <input
                    type="checkbox"
                    checked={draft.remindOnLeave}
                    onChange={e => setDraft(d => ({ ...d, remindOnLeave: e.target.checked }))}
                    className="accent-terracotta"
                  />
                  Remind on leaving
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={submit}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-3 py-2 rounded-lg"
                >
                  Save fence
                </button>
                {!geoSupported && (
                  <span className="text-[11px] text-amber-300">This browser doesn&rsquo;t expose location. Enter lat/lng by hand.</span>
                )}
              </div>

              {(info || err) && (
                <div
                  className={`mt-2 flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    err
                      ? 'border border-red-500/30 bg-red-500/10 text-red-200'
                      : 'border border-green-500/25 bg-green-500/5 text-green-200'
                  }`}
                >
                  {err ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
                  <span>{err || info}</span>
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 flex flex-col">
            <h2 className="text-sm font-semibold text-white">Runtime</h2>
            <p className="text-xs text-slate-400 leading-relaxed mt-1">
              The watcher runs while this tab is open. Close the tab and tracking stops, which keeps
              battery and privacy costs down. Allow notifications to hear the reminders without watching
              this screen.
            </p>

            <div className="mt-4 space-y-2 text-xs">
              <Row label="Geolocation" value={geoSupported ? 'Supported' : 'Unavailable'} ok={geoSupported} />
              <Row label="Notifications" value={notifPermission} ok={notifPermission === 'granted'} />
              <Row label="Fences configured" value={fences.length} ok={fences.length > 0} />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enableNotifications}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800"
              >
                <Bell className="w-3.5 h-3.5" />
                Enable notifications
              </button>
              <button
                type="button"
                onClick={() => setWatcherOn(v => !v)}
                disabled={!geoSupported || fences.length === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {watcherOn ? <BellOff className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                {watcherOn ? 'Stop watcher' : 'Start watcher'}
              </button>
            </div>
            {watcherOn && (
              <p className="mt-3 text-[11px] text-green-300">Watching. Keep this tab open.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-white mb-3">Your fences</h2>
          {fences.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-400">
              No fences yet. Add one above.
            </div>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fences.map(f => (
                <li key={f.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-terracotta mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{f.label}</p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      {f.lat.toFixed(5)}, {f.lng.toFixed(5)} · r={f.radiusM}m
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {f.remindOnEnter ? 'Ping on enter' : 'No enter ping'} · {f.remindOnLeave ? 'Ping on leave' : 'No leave ping'}
                      {f.linkedEmployer ? ` · ${f.linkedEmployer}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeGeofence(f.id)}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-300"
                    aria-label="Delete fence"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-10">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

function Row({ label, value, ok }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className={`font-mono ${ok ? 'text-green-300' : 'text-slate-300'}`}>{String(value)}</span>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] font-medium text-slate-500 uppercase tracking-[0.16em] mb-1">{label}</span>
      {children}
    </label>
  )
}

function emptyDraft() {
  return {
    label: '',
    linkedEmployer: '',
    lat: '',
    lng: '',
    radiusM: String(DEFAULT_RADIUS),
    remindBeforeMin: '15',
    remindOnEnter: true,
    remindOnLeave: true,
  }
}

const inputCls =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm nums focus:outline-none focus:border-terracotta'
