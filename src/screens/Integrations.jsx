import { useEffect, useReducer, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plug, CalendarDays, Clock, FileText, Link2, AlertCircle, CheckCircle2,
  Trash2, Download, ArrowRight, Loader2,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { REGISTRY, listIntegrations, getAdapter } from '../lib/integrations'
import { mergeShifts } from '../lib/integrations/shiftShape'
import {
  getIntegrations, getIntegration, saveIntegration, markIntegrationSynced, removeIntegration,
  getShifts, saveShifts,
} from '../lib/storage'

/**
 * Integrations hub. One card per adapter, grouped by kind. Each card shows:
 *   - Connection state (connected / not connected)
 *   - A minimal connect form tailored to the adapter's auth type
 *   - Sync button that calls `importShifts` and merges into the shift log
 *   - Last-sync timestamp + how many shifts were added on that sync
 *
 * This lives on top of the storage helpers in `src/lib/storage.js` so nothing here is
 * destructive; removing an integration only clears the token, it does not touch shifts.
 */

const KIND_LABELS = {
  calendar: { label: 'Calendar', icon: CalendarDays },
  time_tracker: { label: 'Hour tracker', icon: Clock },
  workforce: { label: 'Workforce CSV', icon: FileText },
}

export default function IntegrationsScreen() {
  const [, bump] = useReducer(n => n + 1, 0)
  useEffect(() => {
    const on = () => bump()
    window.addEventListener('shiftguard-data-changed', on)
    return () => window.removeEventListener('shiftguard-data-changed', on)
  }, [])

  const adapters = useMemo(() => listIntegrations(), [])
  // Re-read on every render triggered by the data-changed event. Cheap and always fresh.
  const connected = Object.fromEntries(getIntegrations().map(i => [i.id, i]))

  const grouped = useMemo(() => {
    const out = {}
    for (const a of adapters) {
      const kind = a.kind || 'other'
      if (!out[kind]) out[kind] = []
      out[kind].push(a)
    }
    return out
  }, [adapters])

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta mb-3">
            <Plug className="w-3.5 h-3.5" />
            Integrations
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
            Bring your hours from anywhere
          </h1>
          <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mt-1">
            Connect a calendar, an hour tracker, or drop in a workforce-management CSV export. Each sync
            converts events into ShiftGuard shifts and merges them into your log. Tokens stay on this
            device; nothing is stored on a server you don&rsquo;t control.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <Link to="/geofence" className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5 hover:border-slate-700">
              Geofence reminders
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link to="/log" className="inline-flex items-center gap-1.5 rounded-full border border-slate-800 bg-slate-900/40 px-3 py-1.5 hover:border-slate-700">
              Back to shift logger
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {Object.keys(grouped).map(kind => (
          <section key={kind} className="mb-10">
            <KindHeader kind={kind} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grouped[kind].map(adapter => (
                <IntegrationCard
                  key={adapter.id}
                  adapter={adapter}
                  record={connected[adapter.id] || null}
                  onSaved={() => bump()}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="mt-10">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

function KindHeader({ kind }) {
  const meta = KIND_LABELS[kind] || { label: 'Other', icon: Plug }
  const Icon = meta.icon
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-terracotta" />
      <p className="text-xs font-medium text-slate-400 uppercase tracking-[0.16em]">{meta.label}</p>
    </div>
  )
}

function IntegrationCard({ adapter, record, onSaved }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [token, setToken] = useState(record?.token || '')
  const [icalUrl, setIcalUrl] = useState(record?.icalUrl || '')
  const [csvText, setCsvText] = useState('')
  const [jsonText, setJsonText] = useState('')
  const [placeFilterName, setPlaceFilterName] = useState('')
  const [minDurationMin, setMinDurationMin] = useState(120)

  const connected = !!record?.connectedAt

  async function connectToken() {
    setBusy(true); setError(''); setInfo('')
    try {
      const verify = adapter.verify
      if (verify) await verify({ token })
      saveIntegration(adapter.id, {
        name: adapter.name,
        token,
      })
      setInfo('Connected. Ready to sync.')
      onSaved?.()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function connectIcal() {
    setBusy(true); setError(''); setInfo('')
    try {
      if (!icalUrl) throw new Error('Paste the iCal URL first.')
      saveIntegration(adapter.id, {
        name: adapter.name,
        icalUrl,
      })
      setInfo('Saved. Hit sync to import events.')
      onSaved?.()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true); setError(''); setInfo('')
    try {
      const live = getIntegration(adapter.id) || { id: adapter.id, name: adapter.name }
      let imported = []
      if (adapter.authType === 'ical_url') {
        imported = await adapter.importShifts({ icalUrl: live.icalUrl })
      } else if (adapter.authType === 'token') {
        imported = await adapter.importShifts({ token: live.token })
      } else if (adapter.authType === 'csv_upload') {
        if (!csvText.trim()) throw new Error('Paste or drop in the CSV first.')
        imported = await adapter.importShifts({ csv: csvText })
      } else if (adapter.authType === 'json_upload') {
        if (!jsonText.trim()) throw new Error('Drop in the Location History JSON file first.')
        imported = await adapter.importShifts({
          timelineJson: jsonText,
          minDurationMinutes: Number(minDurationMin) || 120,
          placeFilter: placeFilterName.trim()
            ? { kind: 'name', value: placeFilterName.trim() }
            : null,
        })
      }

      const existing = getShifts()
      const { merged, added } = mergeShifts(existing, imported)
      saveShifts(merged)
      markIntegrationSynced(adapter.id, { count: added })
      setInfo(`Synced ${imported.length} event${imported.length === 1 ? '' : 's'}; added ${added} new shift${added === 1 ? '' : 's'}.`)
      onSaved?.()
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setBusy(false)
    }
  }

  async function onCsvFile(file) {
    if (!file) return
    const text = await file.text()
    setCsvText(text)
  }

  async function onJsonFile(file) {
    if (!file) return
    const text = await file.text()
    setJsonText(text)
  }

  function disconnect() {
    removeIntegration(adapter.id)
    setToken(''); setIcalUrl(''); setCsvText(''); setJsonText('')
    setInfo('Disconnected.')
    onSaved?.()
  }

  return (
    <article className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-white font-semibold text-base">{adapter.name}</h3>
          {adapter.blurb && <p className="text-xs text-slate-400 leading-relaxed mt-1">{adapter.blurb}</p>}
        </div>
        <StatusPill connected={connected} kind={adapter.authType} />
      </header>

      {connected && record?.lastSyncAt && (
        <p className="mt-3 text-[11px] text-slate-500">
          Last sync {new Date(record.lastSyncAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {typeof record.lastSyncCount === 'number' && ` · +${record.lastSyncCount} new shift${record.lastSyncCount === 1 ? '' : 's'}`}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!connected ? (
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-terracotta hover:text-terracotta-light px-3 py-1.5 rounded-lg border border-terracotta/40 hover:border-terracotta transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            Connect
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={syncNow}
              disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-3 py-1.5 rounded-lg disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Sync now
            </button>
            <button
              type="button"
              onClick={() => setOpen(v => !v)}
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600"
            >
              {open ? 'Hide settings' : 'Edit connection'}
            </button>
            <button
              type="button"
              onClick={disconnect}
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-300 px-2 py-1.5"
            >
              <Trash2 className="w-3 h-3" />
              Disconnect
            </button>
          </>
        )}
      </div>

      {(open || !connected) && (
        <div className="mt-4 space-y-3 border-t border-slate-800/80 pt-4">
          <p className="text-[11px] text-slate-500 leading-relaxed">{adapter.connectHelp}</p>
          {adapter.authType === 'ical_url' && (
            <>
              <Field label="iCal URL">
                <input
                  type="url"
                  value={icalUrl}
                  onChange={e => setIcalUrl(e.target.value)}
                  placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                  className={inputCls}
                />
              </Field>
              <SaveRow onSave={connectIcal} busy={busy} label="Save URL" />
            </>
          )}
          {adapter.authType === 'token' && (
            <>
              <Field label={`${adapter.name} token`}>
                <input
                  type="password"
                  value={token}
                  onChange={e => setToken(e.target.value)}
                  placeholder="Personal access token"
                  autoComplete="off"
                  className={inputCls}
                />
              </Field>
              <SaveRow onSave={connectToken} busy={busy} label="Verify & save" />
            </>
          )}
          {adapter.authType === 'csv_upload' && (
            <>
              <Field label="Drop CSV here, or paste its text">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={e => onCsvFile(e.target.files?.[0])}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-200 file:text-xs"
                />
              </Field>
              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                rows={4}
                placeholder="date,start,end,break,tips,employer\n2026-04-10,09:00,17:30,30,0,Target"
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-terracotta"
              />
              <div className="flex items-center gap-2">
                <SaveRow
                  onSave={() => {
                    saveIntegration(adapter.id, { name: adapter.name })
                    syncNow()
                  }}
                  busy={busy}
                  label="Import CSV"
                />
                {csvText && (
                  <button
                    type="button"
                    onClick={() => setCsvText('')}
                    className="text-[11px] text-slate-400 hover:text-red-300 px-2 py-1.5 rounded-md border border-slate-800 hover:border-red-500/50"
                  >
                    Undo upload
                  </button>
                )}
              </div>
            </>
          )}

          {adapter.authType === 'json_upload' && (
            <>
              <Field label="Drop the Location History month JSON file">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={e => onJsonFile(e.target.files?.[0])}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-slate-200 file:text-xs"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Only visits to (optional, partial match)">
                  <input
                    type="text"
                    value={placeFilterName}
                    onChange={e => setPlaceFilterName(e.target.value)}
                    placeholder="Memorial Hermann"
                    className={inputCls}
                  />
                </Field>
                <Field label="Min visit length (minutes)">
                  <input
                    type="number"
                    min="15"
                    value={minDurationMin}
                    onChange={e => setMinDurationMin(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <SaveRow
                  onSave={() => {
                    saveIntegration(adapter.id, { name: adapter.name })
                    syncNow()
                  }}
                  busy={busy}
                  label="Import timeline"
                />
                {jsonText && (
                  <button
                    type="button"
                    onClick={() => setJsonText('')}
                    className="text-[11px] text-slate-400 hover:text-red-300 px-2 py-1.5 rounded-md border border-slate-800 hover:border-red-500/50"
                  >
                    Undo upload
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {(info || error) && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
            error
              ? 'border border-red-500/30 bg-red-500/10 text-red-200'
              : 'border border-green-500/25 bg-green-500/5 text-green-200'
          }`}
        >
          {error ? <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{error || info}</span>
        </div>
      )}
    </article>
  )
}

function SaveRow({ onSave, busy, label }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onSave}
        disabled={busy}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-terracotta hover:bg-terracotta-dark px-3 py-2 rounded-lg disabled:opacity-60"
      >
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {label}
      </button>
      <p className="text-[11px] text-slate-500">Stored on this device.</p>
    </div>
  )
}

function StatusPill({ connected, kind }) {
  if (!connected) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 border border-slate-700 px-2 py-0.5 rounded-full uppercase tracking-wider">
        Not connected
      </span>
    )
  }
  if (kind === 'csv_upload') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-300 border border-slate-500/40 bg-slate-700/40 px-2 py-0.5 rounded-full uppercase tracking-wider">
        Ready
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-300 border border-green-500/30 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
      <CheckCircle2 className="w-2.5 h-2.5" />
      Connected
    </span>
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

const inputCls =
  'w-full bg-slate-900 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-terracotta'

/* Keep the registry referenced so tree-shakers don't drop it on adapter additions. */
void REGISTRY
void getAdapter
