import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  Camera, Upload, FileImage, Loader2, CheckCircle2, AlertCircle,
  ArrowRight, ArrowLeft, X, Pencil, DollarSign
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { parsePaystub, parsePaystubFromText } from '../lib/claudeClient'
import { extractTextFromImage } from '../lib/ocrSpace'
import {
  savePaystub, getPaystub, getPaystubImage, savePaystubImage,
  saveStubToVault, getPaystubVault, getUserPreferences, pushAnomaly,
} from '../lib/storage'
import { detectAnomalies } from '../lib/anomalies'
import { redactSecrets, logSafe } from '../lib/sanitize'

const STEPS = {
  UPLOAD: 'upload',
  PARSING: 'parsing',
  REVIEW: 'review',
  ERROR: 'error',
}

export default function PaystubUpload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const [step, setStep] = useState(STEPS.UPLOAD)
  const [imagePreview, setImagePreview] = useState(null)
  const [parsedData, setParsedData] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [reviewSource, setReviewSource] = useState('scan')
  const [confirmError, setConfirmError] = useState('')
  // Hybrid pipeline stage: 'idle' | 'ocr' | 'map' | 'vision-fallback'
  const [parseStage, setParseStage] = useState('idle')

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const existing = getPaystub()
      const hasNumbers =
        existing &&
        typeof existing === 'object' &&
        (Number(existing.hourly_rate) > 0 ||
          Number(existing.hours_paid) > 0 ||
          Number(existing.gross_pay) > 0)
      if (hasNumbers) {
        setParsedData(existing)
        const img = getPaystubImage()
        if (img) setImagePreview(img)
        setReviewSource('saved')
        setStep(STEPS.REVIEW)
      }
    })
    return () => cancelAnimationFrame(id)
  }, [])

  const processFile = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      setErrorMsg('Please upload an image file (JPEG, PNG, or WebP).')
      setStep(STEPS.ERROR)
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('Image is too large. Please use an image under 20MB.')
      setStep(STEPS.ERROR)
      return
    }

    const preview = URL.createObjectURL(file)
    setImagePreview(preview)
    setStep(STEPS.PARSING)
    setConfirmError('')
    setParseStage('idle')

    let mediaType = file.type || 'image/jpeg'
    if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
    if (!mediaType.startsWith('image/')) mediaType = 'image/jpeg'

    // Hybrid pipeline:
    //   1. OCR.space extracts layout-aware text from the image.
    //   2. Claude (text mode) maps that text into the paystub JSON schema via
    //      forced tool use.
    //   3. If OCR fails for any reason we fall back to Claude's Vision API so
    //      the user is never blocked by a single upstream outage.
    let result = null
    try {
      setParseStage('ocr')
      const ocrText = await extractTextFromImage(file, mediaType)
      setParseStage('map')
      result = await parsePaystubFromText(ocrText)
    } catch (ocrErr) {
      const ocrMsg = redactSecrets(ocrErr?.message || String(ocrErr))
      const configIssue = /configured|x-api-key|ANTHROPIC/i.test(ocrMsg)
      logSafe('[paystub] OCR+Claude path failed, falling back to Vision.', ocrMsg)
      if (configIssue) {
        setErrorMsg(ocrMsg)
        setStep(STEPS.ERROR)
        setParseStage('idle')
        return
      }
      try {
        setParseStage('vision-fallback')
        const base64 = await fileToBase64(file)
        result = await parsePaystub(base64, mediaType)
      } catch (visionErr) {
        const msg = redactSecrets(visionErr?.message || String(visionErr))
        if (/configured|x-api-key|ANTHROPIC/i.test(msg)) {
          setErrorMsg(msg)
        } else if (/API error|timed out|connect|OCR/i.test(msg)) {
          setErrorMsg('The scanner could not be reached. Check your connection, or enter pay stub data by hand.')
        } else {
          setErrorMsg(msg.length > 10 ? msg : 'We could not read this pay stub. Try a clearer photo or enter the data by hand.')
        }
        setStep(STEPS.ERROR)
        setParseStage('idle')
        return
      }
    }

    setParseStage('idle')

    if (!result) {
      setErrorMsg('We could not extract any fields. Try a clearer photo or enter the numbers by hand.')
      setStep(STEPS.ERROR)
      return
    }

    if (result.parse_confidence != null && result.parse_confidence < 0.3) {
      const note = result.notes || "This doesn't look like a pay stub."
      setErrorMsg(`Image not recognized as a pay stub: ${note} Try a clearer photo, or enter your data by hand.`)
      setStep(STEPS.ERROR)
      return
    }

    const looksEmpty = !result.employer_name && !Number(result.gross_pay) && !Number(result.hours_paid)
    if (looksEmpty) {
      setErrorMsg("We couldn't find pay stub data in this image. Make sure the full stub is visible and in focus, or enter the numbers by hand.")
      setStep(STEPS.ERROR)
      return
    }

    setParsedData(result)
    setReviewSource('scan')
    setStep(STEPS.REVIEW)
  }, [])

  function handleFileSelect(e) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    setDragActive(true)
  }

  function handleDragLeave() {
    setDragActive(false)
  }

  function validateStub(d) {
    const issues = []
    if (!String(d.employer_name || '').trim()) issues.push('Employer name is required.')
    const rate = Number(d.hourly_rate)
    if (!rate || rate <= 0) issues.push('Hourly rate must be greater than zero.')
    const hp = Number(d.hours_paid)
    const otp = Number(d.overtime_hours_paid)
    if (hp < 0 || otp < 0) issues.push('Hours cannot be negative.')
    if (!String(d.pay_period_start || '').trim() || !String(d.pay_period_end || '').trim()) {
      issues.push('Pay period start and end dates help match your shift log. Please add them.')
    }
    return issues
  }

  function handleConfirm() {
    const issues = validateStub(parsedData)
    if (issues.length) {
      setConfirmError(issues.join(' '))
      return
    }
    setConfirmError('')
    savePaystub(parsedData)
    const stableImage = imagePreview && !imagePreview.startsWith('blob:') ? imagePreview : null
    if (stableImage) savePaystubImage(stableImage)
    saveStubToVault(parsedData, stableImage)

    // Continuous wage-check: run the cross-stub anomaly detector and post findings.
    const prefs = getUserPreferences()
    if (prefs.continuousWageCheck !== false) {
      const anomalies = detectAnomalies(getPaystubVault())
      for (const a of anomalies) pushAnomaly(a)
    }

    navigate('/compare')
  }

  function handleManualEntry() {
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setConfirmError('')
    setReviewSource('manual')
    setParsedData({
      employer_name: '',
      pay_period_start: '',
      pay_period_end: '',
      hours_paid: 0,
      overtime_hours_paid: 0,
      hourly_rate: 0,
      overtime_rate: 0,
      gross_pay: 0,
      deductions: [],
      tips_reported: 0,
      net_pay: 0,
    })
    setStep(STEPS.REVIEW)
  }

  function handleReset() {
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    savePaystubImage(null)
    setStep(STEPS.UPLOAD)
    setImagePreview(null)
    setParsedData(null)
    setErrorMsg('')
    setConfirmError('')
    setReviewSource('scan')
  }

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 pb-20">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-white tracking-tight mb-1">Upload your pay stub</h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Snap a photo or drop the image in. Every field gets pulled out for you to review before anything is saved.
              You can also type the numbers in by hand.
            </p>
          </div>
          <Link
            to="/vault"
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 rounded-lg px-3 py-2 transition-colors"
          >
            Open vault
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {step === STEPS.UPLOAD && (
          <UploadStep
            fileInputRef={fileInputRef}
            cameraInputRef={cameraInputRef}
            dragActive={dragActive}
            onFileSelect={handleFileSelect}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onManualEntry={handleManualEntry}
          />
        )}

        {step === STEPS.PARSING && (
          <ParsingStep imagePreview={imagePreview} onUndo={handleReset} stage={parseStage} />
        )}

        {step === STEPS.REVIEW && (
          <ReviewStep
            data={parsedData}
            setData={setParsedData}
            imagePreview={imagePreview}
            reviewSource={reviewSource}
            confirmError={confirmError}
            onConfirm={handleConfirm}
            onReset={handleReset}
          />
        )}

        {step === STEPS.ERROR && (
          <ErrorStep
            message={errorMsg}
            onRetry={handleReset}
            onManualEntry={handleManualEntry}
          />
        )}

        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/log')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to shifts
          </button>
        </div>

        <div className="mt-6">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

/* ---------- Upload Step ---------- */

function UploadStep({
  fileInputRef, cameraInputRef, dragActive,
  onFileSelect, onDrop, onDragOver, onDragLeave, onManualEntry,
}) {
  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-terracotta bg-terracotta/5'
            : 'border-slate-700 hover:border-slate-600'
        }`}
      >
        <FileImage className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <p className="text-white font-medium mb-1">Drop your pay stub here</p>
        <p className="text-slate-500 text-sm">or click to browse. JPEG, PNG, or WebP.</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileSelect}
          className="hidden"
        />
      </div>

      {/* Camera button */}
      <button
        onClick={() => cameraInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-slate-900 border border-slate-800 text-white font-medium hover:border-slate-700 transition-colors cursor-pointer"
      >
        <Camera className="w-5 h-5 text-terracotta" />
        Take a photo
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFileSelect}
        className="hidden"
      />

      {/* Manual entry */}
      <div className="text-center pt-2">
        <button
          onClick={onManualEntry}
          className="text-sm text-slate-500 hover:text-terracotta transition-colors cursor-pointer underline underline-offset-2"
        >
          No pay stub? Enter data manually
        </button>
      </div>

      {/* Privacy note */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mt-4">
        <p className="text-xs text-slate-400 leading-relaxed">
          <span className="text-slate-300 font-medium">Privacy: </span>
          Your image is sent straight to the parser and discarded after the response comes back.
          Nothing is saved on a server you don&rsquo;t control. Everything else stays on this device.
        </p>
      </div>
    </div>
  )
}

/* ---------- Parsing Step ---------- */

function ParsingStep({ imagePreview, onUndo, stage = 'idle' }) {
  // Two-stage pipeline: OCR extracts the text, then the assistant maps it to
  // our schema. Fallback: if OCR fails we switch to the Vision API instead.
  const stages = [
    { id: 'ocr', label: 'Extracting text with OCR' },
    { id: 'map', label: 'Mapping fields to the schema' },
  ]
  const activeIdx = stage === 'vision-fallback'
    ? 1
    : stages.findIndex(s => s.id === stage)

  return (
    <div className="space-y-6">
      {imagePreview && (
        <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-100 flex items-center justify-center p-3 sm:p-4">
          <img
            src={imagePreview}
            alt="Paystub preview"
            className="block w-full max-w-[720px] h-auto max-h-[520px] object-contain rounded-lg shadow-md"
          />
        </div>
      )}
      <div className="py-2">
        <div className="flex items-center gap-3">
          <Loader2 className="w-6 h-6 text-terracotta shrink-0 animate-spin" />
          <div className="min-w-0">
            <p className="text-white font-medium">Reading your pay stub</p>
            <p className="text-slate-500 text-xs">
              {stage === 'vision-fallback'
                ? 'OCR was unavailable. Falling back to the vision model.'
                : 'Two-step pipeline: layout-aware OCR, then structured mapping.'}
            </p>
          </div>
        </div>

        <ol className="mt-4 space-y-2" aria-label="Parsing progress">
          {stages.map((s, i) => {
            const isActive = i === activeIdx
            const isDone = activeIdx > i
            return (
              <li
                key={s.id}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
                  isActive
                    ? 'border-terracotta/40 bg-terracotta/10 text-terracotta'
                    : isDone
                      ? 'border-green-500/25 bg-green-500/5 text-green-200'
                      : 'border-slate-800 bg-slate-900/50 text-slate-500'
                }`}
              >
                <span
                  className={`inline-flex w-5 h-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                    isActive
                      ? 'bg-terracotta text-slate-950'
                      : isDone
                        ? 'bg-green-500/30 text-green-200'
                        : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3 h-3" /> : i + 1}
                </span>
                <span className="font-medium">{s.label}</span>
                {isActive && <Loader2 className="w-3.5 h-3.5 ml-auto animate-spin" />}
              </li>
            )
          })}
        </ol>

        {onUndo && (
          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-600"
            >
              <X className="w-3.5 h-3.5" />
              Undo upload
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Review Step ---------- */

function ReviewStep({ data, setData, imagePreview, reviewSource, confirmError, onConfirm, onReset }) {
  function updateField(field, value) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  function updateNumField(field, value) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  const BANNER_COPY = {
    scan: {
      title: 'Scan complete',
      sub: 'Check each field against the paper or PDF pay stub before continuing.',
    },
    manual: {
      title: 'Manual entry',
      sub: 'Type values exactly as shown on the pay stub. You can attach a photo later by starting over.',
    },
    saved: {
      title: 'Saved pay stub loaded',
      sub: 'Update anything that changed, then run the comparison again.',
    },
  }
  const banner = BANNER_COPY[reviewSource] || BANNER_COPY.scan

  return (
    <div className="space-y-6">
      {/* Status indicator */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        <div>
          <p className="text-green-400 text-sm font-medium">{banner.title}</p>
          <p className="text-slate-500 text-xs mt-0.5">{banner.sub}</p>
        </div>
      </div>

      {confirmError && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/25 text-red-200 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{confirmError}</span>
        </div>
      )}

      {/* Paystub preview */}
      {imagePreview && (
        <PaystubPreviewCard
          imagePreview={imagePreview}
          data={data}
          onReset={onReset}
        />
      )}

      {/* Editable fields */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl divide-y divide-slate-800">
        <FieldGroup title="Employer">
          <ReviewField
            label="Employer name"
            value={data.employer_name}
            onChange={v => updateField('employer_name', v)}
          />
          <div className="grid grid-cols-2 gap-3">
            <ReviewField
              label="Period start"
              value={data.pay_period_start}
              onChange={v => updateField('pay_period_start', v)}
              type="date"
            />
            <ReviewField
              label="Period end"
              value={data.pay_period_end}
              onChange={v => updateField('pay_period_end', v)}
              type="date"
            />
          </div>
        </FieldGroup>

        <FieldGroup title="Hours & Rate">
          <div className="grid grid-cols-2 gap-3">
            <ReviewField
              label="Hours paid"
              value={data.hours_paid}
              onChange={v => updateNumField('hours_paid', v)}
              type="number"
              step="0.5"
            />
            <ReviewField
              label="Hourly rate ($)"
              value={data.hourly_rate}
              onChange={v => updateNumField('hourly_rate', v)}
              type="number"
              step="0.01"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ReviewField
              label="OT hours paid"
              value={data.overtime_hours_paid}
              onChange={v => updateNumField('overtime_hours_paid', v)}
              type="number"
              step="0.5"
            />
            <ReviewField
              label="OT rate ($)"
              value={data.overtime_rate}
              onChange={v => updateNumField('overtime_rate', v)}
              type="number"
              step="0.01"
            />
          </div>
        </FieldGroup>

        <FieldGroup title="Pay">
          <div className="grid grid-cols-3 gap-3">
            <ReviewField
              label="Gross pay ($)"
              value={data.gross_pay}
              onChange={v => updateNumField('gross_pay', v)}
              type="number"
              step="0.01"
            />
            <ReviewField
              label="Tips ($)"
              value={data.tips_reported}
              onChange={v => updateNumField('tips_reported', v)}
              type="number"
              step="0.01"
            />
            <ReviewField
              label="Net pay ($)"
              value={data.net_pay}
              onChange={v => updateNumField('net_pay', v)}
              type="number"
              step="0.01"
            />
          </div>
        </FieldGroup>

        {data.deductions?.length > 0 && (
          <FieldGroup title="Deductions">
            <div className="space-y-2">
              {data.deductions.map((d, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">{d.name}</span>
                  <span className="text-white font-medium">${Number(d.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </FieldGroup>
        )}
      </div>

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
      >
        Confirm and compare
        <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  )
}

/* ---------- Error Step ---------- */

function ErrorStep({ message, onRetry, onManualEntry }) {
  return (
    <div className="text-center py-12">
      <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
      <p className="text-white font-medium mb-2">Something went wrong</p>
      <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">{message}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl bg-slate-800 text-white hover:bg-slate-700 transition-colors text-sm font-medium cursor-pointer"
        >
          Try again
        </button>
        <button
          onClick={onManualEntry}
          className="px-6 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-medium cursor-pointer"
        >
          Enter data manually
        </button>
      </div>
    </div>
  )
}

/* ---------- Shared ---------- */

function PaystubPreviewCard({ imagePreview, data, onReset }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
        <div className="min-w-0">
          <p className="text-sm text-white font-medium truncate">
            {data.employer_name || 'Pay stub preview'}
          </p>
          {data.pay_period_start && (
            <p className="text-xs text-slate-500 truncate">
              {data.pay_period_start} to {data.pay_period_end}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] font-medium text-slate-300 hover:text-white px-2 py-1 rounded border border-slate-700 hover:border-slate-600"
          >
            {expanded ? 'Hide image' : 'Show image'}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="p-1.5 text-slate-500 hover:text-red-300 rounded"
            aria-label="Remove paystub"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="bg-slate-100 p-3 sm:p-4 flex items-center justify-center">
          <img
            src={imagePreview}
            alt="Paystub preview"
            className="block w-full max-w-[720px] h-auto object-contain rounded-lg shadow-md"
          />
        </div>
      )}
    </div>
  )
}

function FieldGroup({ title, children }) {
  return (
    <div className="p-4 space-y-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      {children}
    </div>
  )
}

function ReviewField({ label, value, onChange, type = 'text', step }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        step={step}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-terracotta"
      />
    </div>
  )
}

/* ---------- Helpers ---------- */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
