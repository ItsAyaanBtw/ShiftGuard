import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Loader2, CheckCircle2, AlertCircle, ShieldCheck,
  ArrowRight, ArrowLeft, FileText, Sparkles, Info, ListPlus,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { parseTimesheet } from '../lib/claudeClient'
import {
  getShifts, saveShifts, getTimesheetRecord, saveTimesheetRecord,
} from '../lib/storage'
import { reconcileShifts, entryToShiftDraft } from '../lib/timesheetReconcile'

/**
 * Employer-record verification flow. Worker uploads a timesheet screenshot, punch export,
 * or posted schedule (image or PDF). Claude parses it with forced tool use, then we
 * reconcile each logged shift against the entries so the downstream paycheck comparison
 * runs on hours the worker can actually back up.
 */

const ACCEPT_IMG = 'image/*'
const ACCEPT_ALL = 'image/*,application/pdf'
const MAX_BYTES = 12 * 1024 * 1024

const STEPS = {
  INTRO: 'intro',
  PARSING: 'parsing',
  REVIEW: 'review',
  ERROR: 'error',
}

export default function TimesheetUpload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const [step, setStep] = useState(STEPS.INTRO)
  const [dragActive, setDragActive] = useState(false)
  const [fileLabel, setFileLabel] = useState('')
  const [timesheet, setTimesheet] = useState(null)
  const [reconciliation, setReconciliation] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const existing = getTimesheetRecord()
      if (existing && Array.isArray(existing.entries) && existing.entries.length) {
        const shifts = getShifts()
        const r = reconcileShifts(shifts, existing)
        setTimesheet(existing)
        setReconciliation(r)
        setStep(STEPS.REVIEW)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const processFile = useCallback(async file => {
    if (!file) return
    const isPdf = file.type === 'application/pdf'
    const isImg = file.type.startsWith('image/')
    if (!isPdf && !isImg) {
      setErrorMsg('Upload a JPEG, PNG, WebP, or PDF.')
      setStep(STEPS.ERROR)
      return
    }
    if (file.size > MAX_BYTES) {
      setErrorMsg('File is over 12 MB. Crop or export a smaller copy and try again.')
      setStep(STEPS.ERROR)
      return
    }

    setFileLabel(file.name || (isPdf ? 'Time record PDF' : 'Time record image'))
    setStep(STEPS.PARSING)

    try {
      const base64 = await fileToBase64(file)
      const mediaType = isPdf ? 'application/pdf' : file.type || 'image/jpeg'
      const parsed = await parseTimesheet(base64, mediaType)

      if (!parsed.entries.length) {
        throw new Error(
          'No clock-in or clock-out rows were readable on this document. Try a sharper photo or export the timesheet as PDF.',
        )
      }
      if (parsed.parse_confidence > 0 && parsed.parse_confidence < 0.3) {
        throw new Error(
          parsed.notes ||
            'The document did not look like a time record. Try a clearer photo or a different page.',
        )
      }

      const shifts = getShifts()
      const r = reconcileShifts(shifts, parsed)
      saveTimesheetRecord(parsed)
      saveShifts(r.shifts)
      setTimesheet(parsed)
      setReconciliation(r)
      setStep(STEPS.REVIEW)
    } catch (err) {
      console.error('Timesheet parse failed:', err)
      setErrorMsg(err?.message || 'Could not read this document. Try a clearer photo.')
      setStep(STEPS.ERROR)
    }
  }, [])

  function onFileSelect(e) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
    e.target.value = ''
  }
  function onDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) processFile(f)
  }
  function onDragOver(e) { e.preventDefault(); setDragActive(true) }
  function onDragLeave() { setDragActive(false) }

  function onAddMissingEntry(entry) {
    const draft = entryToShiftDraft(entry)
    const current = getShifts()
    const next = [...current, draft]
    saveShifts(next)
    const r = reconcileShifts(next, timesheet)
    saveShifts(r.shifts)
    setReconciliation(r)
  }

  function onClear() {
    saveTimesheetRecord(null)
    const current = getShifts().map(s => ({
      ...s,
      verification: s.verification?.status === 'manual'
        ? s.verification
        : { status: 'unverified', reasons: [], verifiedAt: null, source: null },
    }))
    saveShifts(current)
    setTimesheet(null)
    setReconciliation(null)
    setFileLabel('')
    setErrorMsg('')
    setStep(STEPS.INTRO)
  }

  function onContinue() {
    navigate('/upload')
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            Hours verification
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Back your hours with an employer record</h1>
          <p className="text-slate-400 text-sm leading-relaxed">
            Upload a timesheet export, a punch report, or a posted schedule. Each logged shift
            gets matched to the document so the paycheck check runs on hours you can prove.
          </p>
        </div>

        {step === STEPS.INTRO && (
          <IntroStep
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            dragActive={dragActive}
            onFileSelect={onFileSelect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          />
        )}

        {step === STEPS.PARSING && (
          <ParsingStep
            label={fileLabel}
            onUndo={() => { setFileLabel(''); setStep(STEPS.INTRO) }}
          />
        )}

        {step === STEPS.REVIEW && (
          <ReviewStep
            timesheet={timesheet}
            reconciliation={reconciliation}
            onReplace={() => fileInputRef.current?.click()}
            onClear={onClear}
            onAddMissingEntry={onAddMissingEntry}
            onContinue={onContinue}
          />
        )}

        {step === STEPS.ERROR && (
          <ErrorStep
            message={errorMsg}
            onRetry={() => {
              setErrorMsg('')
              setStep(STEPS.INTRO)
            }}
          />
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/log')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to shifts
          </button>
          {step === STEPS.REVIEW && (
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:text-terracotta-light transition-colors"
            >
              Continue to pay stub
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="mt-8">
          <Disclaimer />
        </div>
      </main>

      {/* Hidden inputs — kept outside conditional trees so refs are stable */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT_ALL}
        onChange={onFileSelect}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept={ACCEPT_IMG}
        capture="environment"
        onChange={onFileSelect}
        className="hidden"
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Intro                                                               */
/* ------------------------------------------------------------------ */

function IntroStep({
  fileInputRef, cameraInputRef, dragActive,
  onDrop, onDragOver, onDragLeave,
}) {
  return (
    <div className="space-y-4">
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click() }}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-terracotta bg-terracotta/5'
            : 'border-slate-700 hover:border-slate-600 hover:bg-slate-900/40'
        }`}
      >
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-terracotta mb-4">
          <FileText className="w-5 h-5" />
        </div>
        <p className="text-white font-medium mb-1">Drop an employer time record here</p>
        <p className="text-slate-500 text-sm">JPEG, PNG, WebP, or PDF · up to 12 MB</p>
      </div>

      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-medium hover:border-slate-700 transition-colors cursor-pointer"
      >
        <Camera className="w-5 h-5 text-terracotta" />
        Take a photo
      </button>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-[0.14em]">What counts as a time record</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-300">
          {[
            'Kronos / UKG Dimensions timecard',
            'Workday Time Tracking export',
            'ADP Workforce Now timesheet',
            'Paycom / Paylocity punch report',
            'Ceridian Dayforce timesheet',
            'Posted weekly schedule',
          ].map(line => (
            <li key={line} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-terracotta shrink-0" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 leading-relaxed">
          If clock-in and clock-out times are visible, the parser can read it. Handwritten logs and tip-out sheets
          are not a substitute for an employer record.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-terracotta mt-0.5 shrink-0" />
        <p className="text-xs text-slate-400 leading-relaxed">
          The document stays on your device. Only a copy is sent to Anthropic for parsing and is discarded after
          the response returns. Nothing is saved on a server you don&rsquo;t control.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Parsing                                                              */
/* ------------------------------------------------------------------ */

function ParsingStep({ label, onUndo }) {
  return (
    <div className="text-center py-12">
      <Loader2 className="w-10 h-10 text-terracotta mx-auto mb-4 animate-spin" />
      <p className="text-white font-medium mb-1">Reading {label || 'your time record'}</p>
      <p className="text-slate-500 text-sm">Usually 5 to 12 seconds.</p>
      {onUndo && (
        <button
          type="button"
          onClick={onUndo}
          className="mt-5 inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600"
        >
          Undo upload
        </button>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Review                                                               */
/* ------------------------------------------------------------------ */

function ReviewStep({
  timesheet, reconciliation, onReplace, onClear, onAddMissingEntry, onContinue,
}) {
  const summary = reconciliation?.summary || { verified: 0, mismatch: 0, unverified: 0, extraEntries: 0 }
  const shifts = reconciliation?.shifts || []
  const extras = reconciliation?.extraEntries || []
  const confPct = Math.round((timesheet?.parse_confidence || 0) * 100)

  const totals = {
    shifts: shifts.length,
    verified: summary.verified,
    mismatch: summary.mismatch,
    unverified: summary.unverified,
  }

  const confidenceTone =
    confPct >= 80 ? 'text-green-400 bg-green-500/10 border-green-500/25' :
    confPct >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/25' :
                    'text-red-400 bg-red-500/10 border-red-500/25'

  return (
    <div className="space-y-5">
      {/* Source summary */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">Source document</p>
            <p className="text-white font-medium text-sm mt-1 truncate">
              {timesheet?.source_label || 'Employer time record'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {timesheet?.employer_name || 'Employer not listed'}
              {timesheet?.period_start && timesheet?.period_end && (
                <> · {timesheet.period_start} to {timesheet.period_end}</>
              )}
              {' '}· {timesheet?.entries?.length || 0} punch pairs
            </p>
          </div>
          <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${confidenceTone}`}>
            Confidence {confPct}%
          </div>
        </div>
        {timesheet?.notes && (
          <p className="mt-3 text-xs text-slate-500 leading-relaxed">
            <span className="text-slate-400 font-medium">Note from parser: </span>{timesheet.notes}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={onReplace} className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600 transition-colors">
            Replace document
          </button>
          <button type="button" onClick={onClear} className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-colors">
            Clear and unverify shifts
          </button>
        </div>
      </div>

      {/* Reconciliation summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Shifts logged" value={totals.shifts} tone="neutral" />
        <StatTile label="Verified" value={totals.verified} tone="good" />
        <StatTile label="Mismatched" value={totals.mismatch} tone="warn" />
        <StatTile label="Unmatched" value={totals.unverified} tone="bad" />
      </div>

      {/* Shift list */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
          <p className="text-sm font-medium text-white">Your logged shifts</p>
          <span className="text-[11px] text-slate-500">Times are compared within ±10 min</span>
        </div>
        {shifts.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-400">
            No shifts logged yet.{' '}
            <span className="text-slate-500">Add shifts in Shift Logger, then come back.</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {[...shifts].sort((a, b) => b.date.localeCompare(a.date)).map(s => (
              <ShiftVerificationRow key={s.id} shift={s} />
            ))}
          </ul>
        )}
      </div>

      {/* Extra entries */}
      {extras.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <Info className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-200">
                {extras.length} entr{extras.length === 1 ? 'y is' : 'ies are'} on the time record but not in your shift log
              </p>
              <p className="text-xs text-amber-100/70 mt-1 leading-relaxed">
                Add any that you actually worked so the paycheck check runs on complete data.
              </p>
              <ul className="mt-3 space-y-2">
                {extras.map((e, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-slate-950/40 px-3 py-2">
                    <div className="text-xs text-slate-200 min-w-0">
                      <span className="font-mono">{e.date}</span>
                      <span className="text-slate-500"> · </span>
                      <span className="font-mono">{e.in_time} → {e.out_time}</span>
                      {e.break_minutes > 0 && (
                        <span className="text-slate-500"> · {e.break_minutes}m break</span>
                      )}
                      {e.department && (
                        <span className="text-slate-500"> · {e.department}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddMissingEntry(e)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-terracotta hover:text-terracotta-light px-2 py-1 rounded-md border border-terracotta/30 hover:border-terracotta/60 transition-colors shrink-0"
                    >
                      <ListPlus className="w-3 h-3" />
                      Add to log
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onContinue}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
      >
        Continue to pay stub
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

function ShiftVerificationRow({ shift }) {
  const status = shift.verification?.status || 'unverified'
  const reasons = shift.verification?.reasons || []
  const source = shift.verification?.source
  const entry = shift.verification?.entry

  const badge = STATUS_BADGE[status] || STATUS_BADGE.unverified
  const dateObj = new Date(shift.date + 'T00:00:00')
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <li className="px-4 py-3 flex items-start gap-3">
      <div className={`shrink-0 mt-0.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${badge.cls}`}>
        {badge.icon}
        {badge.label}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white font-medium">
          {dateStr}{' '}
          <span className="font-mono text-slate-300">{shift.clockIn}–{shift.clockOut}</span>
          {shift.breakMinutes > 0 && (
            <span className="text-xs text-slate-500"> · {shift.breakMinutes}m break</span>
          )}
        </div>
        {entry && (
          <div className="text-xs text-slate-500 mt-0.5">
            Time record: <span className="font-mono text-slate-400">{entry.in_time}–{entry.out_time}</span>
            {entry.break_minutes > 0 && <> · {entry.break_minutes}m break</>}
            {source && <> · {source}</>}
          </div>
        )}
        {reasons.length > 0 && (
          <ul className="mt-1 text-[11px] text-amber-300/90 space-y-0.5">
            {reasons.map((r, i) => <li key={i}>• {r}</li>)}
          </ul>
        )}
      </div>
    </li>
  )
}

const STATUS_BADGE = {
  verified: {
    label: 'Verified',
    cls: 'border-green-500/30 bg-green-500/10 text-green-300',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  mismatch: {
    label: 'Off by a bit',
    cls: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  unverified: {
    label: 'Unverified',
    cls: 'border-slate-600 bg-slate-800/60 text-slate-300',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  manual: {
    label: 'Marked by you',
    cls: 'border-slate-500/40 bg-slate-700/40 text-slate-200',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
}

function StatTile({ label, value, tone = 'neutral' }) {
  const toneCls = {
    neutral: 'text-white',
    good: 'text-green-400',
    warn: 'text-amber-400',
    bad: 'text-slate-400',
  }[tone]
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-[0.18em]">{label}</p>
      <p className={`mt-1.5 text-2xl font-semibold nums ${toneCls}`}>{value}</p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Error                                                                */
/* ------------------------------------------------------------------ */

function ErrorStep({ message, onRetry }) {
  return (
    <div className="text-center py-12">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
      <p className="text-white font-medium mb-2">We couldn&rsquo;t read that document</p>
      <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto leading-relaxed">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="px-6 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm font-medium cursor-pointer"
      >
        Try a different file
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                              */
/* ------------------------------------------------------------------ */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = typeof result === 'string' ? result.split(',')[1] : ''
      resolve(base64 || '')
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
