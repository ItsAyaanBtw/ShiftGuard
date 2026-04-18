import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Upload, FileImage, Loader2, CheckCircle2, AlertCircle,
  ArrowRight, ArrowLeft, X, Pencil, DollarSign
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { parsePaystub } from '../lib/claudeClient'
import { savePaystub, getPaystub, getPaystubImage, savePaystubImage } from '../lib/storage'

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

  useEffect(() => {
    const existing = getPaystub()
    if (existing && existing.hourly_rate > 0) {
      setParsedData(existing)
      const img = getPaystubImage()
      if (img) setImagePreview(img)
      setStep(STEPS.REVIEW)
    }
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

    try {
      const base64 = await fileToBase64(file)
      const result = await parsePaystub(base64, file.type)
      setParsedData(result)
      setStep(STEPS.REVIEW)
    } catch (err) {
      console.error('Pay stub parsing failed:', err)
      setErrorMsg(
        err.message.includes('API')
          ? 'Could not connect to the AI service. Check your API key and try again.'
          : 'Could not read this pay stub. Try a clearer photo or enter the data manually.'
      )
      setStep(STEPS.ERROR)
    }
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

  function handleConfirm() {
    savePaystub(parsedData)
    navigate('/compare')
  }

  function handleManualEntry() {
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
  }

  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Pay Stub Upload</h1>
          <p className="text-slate-400 text-sm">
            Upload or photograph your pay stub. Our AI will read it for you.
          </p>
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
          <ParsingStep imagePreview={imagePreview} />
        )}

        {step === STEPS.REVIEW && (
          <ReviewStep
            data={parsedData}
            setData={setParsedData}
            imagePreview={imagePreview}
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
          <span className="text-slate-300 font-medium">Privacy:</span> Your pay stub image is sent
          directly to the AI for analysis and is never stored on any server. All data stays on your
          device.
        </p>
      </div>
    </div>
  )
}

/* ---------- Parsing Step ---------- */

function ParsingStep({ imagePreview }) {
  return (
    <div className="space-y-6">
      {imagePreview && (
        <div className="rounded-xl overflow-hidden border border-slate-800">
          <img src={imagePreview} alt="Pay stub" className="w-full max-h-64 object-contain bg-slate-900" />
        </div>
      )}
      <div className="text-center py-8">
        <Loader2 className="w-10 h-10 text-terracotta mx-auto mb-4 animate-spin" />
        <p className="text-white font-medium mb-1">Reading your pay stub...</p>
        <p className="text-slate-500 text-sm">This usually takes 5-10 seconds.</p>
      </div>
    </div>
  )
}

/* ---------- Review Step ---------- */

function ReviewStep({ data, setData, imagePreview, onConfirm, onReset }) {
  function updateField(field, value) {
    setData(prev => ({ ...prev, [field]: value }))
  }

  function updateNumField(field, value) {
    const num = parseFloat(value)
    setData(prev => ({ ...prev, [field]: isNaN(num) ? 0 : num }))
  }

  return (
    <div className="space-y-6">
      {/* Success indicator */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
        <div>
          <p className="text-green-400 text-sm font-medium">Pay stub parsed successfully</p>
          <p className="text-slate-500 text-xs mt-0.5">Review the data below and correct anything that looks off.</p>
        </div>
      </div>

      {/* Image thumbnail */}
      {imagePreview && (
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
          <img src={imagePreview} alt="Pay stub" className="w-16 h-16 object-cover rounded-lg" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{data.employer_name || 'Pay stub'}</p>
            {data.pay_period_start && (
              <p className="text-xs text-slate-500">{data.pay_period_start} to {data.pay_period_end}</p>
            )}
          </div>
          <button
            onClick={onReset}
            className="p-1.5 text-slate-500 hover:text-slate-300 cursor-pointer"
            aria-label="Remove"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
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
