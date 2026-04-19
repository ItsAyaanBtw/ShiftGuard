import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, ArrowRight, Clock, Coffee, DollarSign,
  AlertTriangle, ChevronDown, X, CalendarDays, ShieldCheck, ShieldAlert, ShieldQuestion,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import {
  getShifts,
  saveShifts,
  getUserState,
  saveUserState,
  getUserCity,
  saveUserCity,
  getUserPreferences,
  saveUserPreferences,
  getTimesheetRecord,
} from '../lib/storage'
import { calcShiftHours } from '../lib/utils'
import stateLaws from '../data/stateLaws'

function newShiftTemplate() {
  return {
    id: '',
    date: new Date().toISOString().slice(0, 10),
    clockIn: '09:00',
    clockOut: '17:00',
    breakMinutes: 30,
    tips: 0,
    flaggedOT: false,
    shiftType: 'day',
    isWeekend: false,
    isHoliday: false,
    chargeNurse: false,
    preceptor: false,
    onCallHours: 0,
  }
}

export default function ShiftLogger() {
  const navigate = useNavigate()
  const skipNextPersist = useRef(false)
  const [shifts, setShifts] = useState(() => getShifts())
  const [stateCode, setStateCode] = useState(() => getUserState())
  const [city, setCity] = useState(() => getUserCity())
  const [showForm, setShowForm] = useState(false)
  const [editingShift, setEditingShift] = useState(null)
  const [formData, setFormData] = useState(newShiftTemplate)
  const [prefs, setPrefs] = useState(() => getUserPreferences())
  const [timesheet, setTimesheet] = useState(() => getTimesheetRecord())

  useEffect(() => {
    const onData = () => {
      skipNextPersist.current = true
      setShifts(getShifts())
      setStateCode(getUserState())
      setCity(getUserCity())
      setPrefs(getUserPreferences())
      setTimesheet(getTimesheetRecord())
    }
    window.addEventListener('shiftguard-data-changed', onData)
    return () => window.removeEventListener('shiftguard-data-changed', onData)
  }, [])

  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false
      return
    }
    saveShifts(shifts)
  }, [shifts])

  function handleStateChange(code) {
    setStateCode(code)
    saveUserState(code)
    setCity(null)
    saveUserCity(null)
  }

  function handleCityChange(c) {
    const val = c || null
    setCity(val)
    saveUserCity(val)
  }

  function updatePrefs(partial) {
    const next = { ...prefs, ...partial }
    saveUserPreferences(next)
    setPrefs(next)
  }

  function openAdd() {
    setEditingShift(null)
    setFormData({ ...newShiftTemplate(), id: crypto.randomUUID() })
    setShowForm(true)
  }

  function openEdit(shift) {
    setEditingShift(shift.id)
    setFormData({ ...newShiftTemplate(), ...shift })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditingShift(null)
  }

  function handleSave() {
    if (!formData.date || !formData.clockIn || !formData.clockOut) return

    if (editingShift) {
      setShifts(prev => prev.map(s => s.id === editingShift ? { ...formData } : s))
    } else {
      setShifts(prev => [...prev, { ...formData }])
    }
    closeForm()
  }

  function handleDelete(id) {
    setShifts(prev => prev.filter(s => s.id !== id))
  }

  const totalHours = shifts.reduce((sum, s) => sum + calcShiftHours(s), 0)
  const totalTips = shifts.reduce((sum, s) => sum + (Number(s.tips) || 0), 0)
  const sortedShifts = [...shifts].sort((a, b) => b.date.localeCompare(a.date))
  const verifiedCount = shifts.filter(s => s?.verification?.status === 'verified').length
  const mismatchCount = shifts.filter(s => s?.verification?.status === 'mismatch').length
  const hasTimesheet = !!(timesheet && Array.isArray(timesheet.entries) && timesheet.entries.length)

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        {/* Title + state selector */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Shift Logger</h1>
            <p className="text-slate-400 text-sm">Log your hours. We&apos;ll compare them to your pay advice.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StateSelector value={stateCode} onChange={handleStateChange} />
            <CitySelector stateCode={stateCode} value={city} onChange={handleCityChange} />
          </div>
        </div>

        <IndustryProfile prefs={prefs} onChange={updatePrefs} />

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <SummaryCard
            icon={<CalendarDays className="w-4 h-4" />}
            label="Shifts"
            value={shifts.length}
          />
          <SummaryCard
            icon={<Clock className="w-4 h-4" />}
            label="Hours"
            value={totalHours.toFixed(1)}
          />
          <SummaryCard
            icon={<DollarSign className="w-4 h-4" />}
            label="Tips"
            value={`$${totalTips.toFixed(2)}`}
          />
        </div>

        {/* OT indicator */}
        {totalHours > 40 && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-amber-400 text-sm">
              {totalHours.toFixed(1)} hours logged this pay period. {(totalHours - 40).toFixed(1)} hours may qualify as overtime in {stateLaws[stateCode]?.name}.
            </p>
          </div>
        )}

        {/* Verification banner */}
        {shifts.length > 0 && (
          <VerificationBanner
            hasTimesheet={hasTimesheet}
            verifiedCount={verifiedCount}
            mismatchCount={mismatchCount}
            unverifiedCount={Math.max(0, shifts.length - verifiedCount - mismatchCount)}
            onGo={() => navigate('/verify')}
          />
        )}

        {/* Shift list */}
        {sortedShifts.length === 0 ? (
          <div className="text-center py-16">
            <Clock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 mb-1">No shifts logged yet.</p>
            <p className="text-slate-500 text-sm">Tap the button below to add your first shift.</p>
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {sortedShifts.map(shift => (
              <ShiftCard
                key={shift.id}
                shift={shift}
                hours={calcShiftHours(shift)}
                onEdit={() => openEdit(shift)}
                onDelete={() => handleDelete(shift.id)}
              />
            ))}
          </div>
        )}

        {/* Add button */}
        <button
          type="button"
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-terracotta hover:text-terracotta transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Add shift
        </button>

        {/* Continue — verify first, then pay stub */}
        {shifts.length > 0 && (
          <button
            type="button"
            onClick={() => navigate(hasTimesheet ? '/upload' : '/verify')}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            {hasTimesheet ? 'Continue to pay stub' : 'Verify hours with an employer record'}
            <ArrowRight className="w-5 h-5" />
          </button>
        )}

        <div className="mt-8">
          <Disclaimer />
        </div>
      </main>

      {/* Add/Edit modal */}
      {showForm && (
        <ShiftFormModal
          formData={formData}
          setFormData={setFormData}
          onSave={handleSave}
          onClose={closeForm}
          isEditing={!!editingShift}
          industryMode={prefs.industryMode || (prefs.healthcareMode ? 'healthcare' : 'general')}
        />
      )}
    </div>
  )
}

function StateSelector({ value, onChange }) {
  const states = Object.values(stateLaws)

  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-slate-800 border border-slate-700 text-white text-sm rounded-lg pl-3 pr-8 py-2 cursor-pointer focus:outline-none focus:border-terracotta"
      >
        {states.map(s => (
          <option key={s.code} value={s.code}>{s.code} · {s.name}</option>
        ))}
      </select>
      <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

function CitySelector({ stateCode, value, onChange }) {
  const state = stateLaws[stateCode]
  const cities = state ? Object.keys(state.minimumWage.localOverrides) : []
  if (cities.length === 0) return null

  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-slate-800 border border-slate-700 text-white text-xs rounded-lg pl-3 pr-7 py-1.5 cursor-pointer focus:outline-none focus:border-terracotta"
      >
        <option value="">State default</option>
        {cities.map(c => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  )
}

function SummaryCard({ icon, label, value }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-slate-400 mb-1">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  )
}

function ShiftCard({ shift, hours, onEdit, onDelete }) {
  const dateObj = new Date(shift.date + 'T00:00:00')
  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const vStatus = shift.verification?.status || 'unverified'
  const vTone =
    vStatus === 'verified' ? 'border-green-500/25 bg-green-500/5' :
    vStatus === 'mismatch' ? 'border-amber-500/25 bg-amber-500/5' :
                              'border-slate-800 bg-slate-900'

  return (
    <div className={`border rounded-xl p-4 flex items-center gap-4 group hover:border-slate-700 transition-colors ${vTone}`}>
      {/* Date block */}
      <div className="text-center shrink-0 w-14">
        <div className="text-xs text-slate-500 uppercase">{dayName}</div>
        <div className="text-sm font-semibold text-white">{dateStr}</div>
      </div>

      {/* Shift details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm text-white flex-wrap">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{shift.clockIn} to {shift.clockOut}</span>
          <span className="text-slate-500">·</span>
          <span className="text-terracotta font-medium">{hours.toFixed(1)}h</span>
          <VerificationPill status={vStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
          {shift.breakMinutes > 0 && (
            <span className="flex items-center gap-1">
              <Coffee className="w-3 h-3" />
              {shift.breakMinutes}m break
            </span>
          )}
          {Number(shift.tips) > 0 && (
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              ${Number(shift.tips).toFixed(2)} tips
            </span>
          )}
          {shift.flaggedOT && (
            <span className="text-amber-500 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              OT
            </span>
          )}
          {shift.shiftType && shift.shiftType !== 'day' && (
            <span className="text-cyan-400/90">{shift.shiftType}</span>
          )}
          {shift.isWeekend && <span className="text-sky-400/90">weekend</span>}
          {shift.isHoliday && <span className="text-rose-400/90">holiday</span>}
          {shift.chargeNurse && <span className="text-violet-400/90">charge</span>}
          {shift.preceptor && <span className="text-violet-400/90">preceptor</span>}
          {Number(shift.onCallHours) > 0 && (
            <span className="text-slate-400">on-call {Number(shift.onCallHours)}h</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={onEdit}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Edit shift"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Delete shift"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ShiftFormModal({ formData, setFormData, onSave, onClose, isEditing, industryMode }) {
  const mode = industryMode || 'general'
  const showShiftType = mode === 'healthcare' || mode === 'warehouse'
  const showWeekendFlag = mode !== 'general'
  const showHolidayFlag = mode !== 'general'
  const showHealthcareRoles = mode === 'healthcare'
  const showTradesExtras = mode === 'trades'

  function update(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shift-modal-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />

      <div className="relative z-[210] w-full max-w-lg bg-slate-900 border border-slate-700/90 rounded-t-2xl sm:rounded-2xl p-6 max-h-[90dvh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 id="shift-modal-title" className="text-lg font-semibold text-white">
            {isEditing ? 'Edit shift' : 'Add shift'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Date */}
          <FormField label="Date">
            <input
              type="date"
              value={formData.date}
              onChange={e => update('date', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
            />
          </FormField>

          {/* Clock in/out */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Clock in">
              <input
                type="time"
                value={formData.clockIn}
                onChange={e => update('clockIn', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
              />
            </FormField>
            <FormField label="Clock out">
              <input
                type="time"
                value={formData.clockOut}
                onChange={e => update('clockOut', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
              />
            </FormField>
          </div>

          {/* Break + Tips */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Break (minutes)">
              <input
                type="number"
                min="0"
                max="120"
                value={formData.breakMinutes}
                onChange={e => update('breakMinutes', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
              />
            </FormField>
            <FormField label="Tips ($)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.tips}
                onChange={e => update('tips', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
              />
            </FormField>
          </div>

          {/* Overtime flag */}
          <label className="flex items-center gap-3 py-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.flaggedOT}
              onChange={e => update('flaggedOT', e.target.checked)}
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-terracotta focus:ring-terracotta accent-terracotta"
            />
            <div>
              <span className="text-sm text-white">This shift included overtime</span>
              <p className="text-xs text-slate-500 mt-0.5">Flag if you worked beyond your normal schedule.</p>
            </div>
          </label>

          {mode !== 'general' && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                {mode === 'healthcare' ? 'Healthcare shift details'
                  : mode === 'warehouse' ? 'Warehouse shift details'
                  : mode === 'restaurant' ? 'Service shift details'
                  : 'Trades shift details'}
              </p>

              {showShiftType && (
                <FormField label="Shift type">
                  <select
                    value={formData.shiftType || 'day'}
                    onChange={e => update('shiftType', e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
                  >
                    <option value="day">Day</option>
                    <option value="evening">Evening</option>
                    <option value="night">Night</option>
                  </select>
                </FormField>
              )}

              {showWeekendFlag && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.isWeekend}
                    onChange={e => update('isWeekend', e.target.checked)}
                    className="accent-terracotta"
                  />
                  <span className="text-sm text-white">Weekend shift</span>
                </label>
              )}

              {showHolidayFlag && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.isHoliday}
                    onChange={e => update('isHoliday', e.target.checked)}
                    className="accent-terracotta"
                  />
                  <span className="text-sm text-white">Holiday shift</span>
                </label>
              )}

              {showHealthcareRoles && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.chargeNurse}
                      onChange={e => update('chargeNurse', e.target.checked)}
                      className="accent-terracotta"
                    />
                    <span className="text-sm text-white">Charge nurse role</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!formData.preceptor}
                      onChange={e => update('preceptor', e.target.checked)}
                      className="accent-terracotta"
                    />
                    <span className="text-sm text-white">Preceptor role</span>
                  </label>
                  <FormField label="On-call hours (if any)">
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={formData.onCallHours ?? 0}
                      onChange={e => update('onCallHours', Number(e.target.value))}
                      className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
                    />
                  </FormField>
                </>
              )}

              {showTradesExtras && (
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.hazardFlag}
                    onChange={e => update('hazardFlag', e.target.checked)}
                    className="accent-terracotta"
                  />
                  <span className="text-sm text-white">Hazard / fringe pay applies</span>
                </label>
              )}
            </div>
          )}
        </div>

        {/* Save */}
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium min-h-[48px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="flex-1 py-3 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-semibold min-h-[48px]"
          >
            {isEditing ? 'Save changes' : 'Add shift'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}

const INDUSTRY_OPTIONS = [
  {
    key: 'general',
    label: 'General hourly',
    blurb: 'Base rate plus federal / state overtime only.',
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    blurb: 'Night, weekend, holiday, charge, and preceptor premiums.',
  },
  {
    key: 'warehouse',
    label: 'Warehouse + retail',
    blurb: 'Night differential and productivity bonus per hour.',
  },
  {
    key: 'restaurant',
    label: 'Restaurant + service',
    blurb: 'Tip credit basis and tip reporting per shift.',
  },
  {
    key: 'trades',
    label: 'Skilled trades',
    blurb: 'Per-diem, hazard, and fringe on top of base rate.',
  },
]

/**
 * Industry pay-pack selector. Drives which per-shift and per-week fields show up, and
 * keeps the legacy `healthcareMode` flag in sync for the current comparison engine.
 */
function IndustryProfile({ prefs, onChange }) {
  const active = prefs.industryMode || (prefs.healthcareMode ? 'healthcare' : 'general')

  function pickIndustry(key) {
    onChange({
      industryMode: key,
      healthcareMode: key === 'healthcare',
    })
  }

  return (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.18em]">Industry pay pack</p>
          <p className="text-sm text-white font-medium mt-1">
            {INDUSTRY_OPTIONS.find(o => o.key === active)?.label || 'General hourly'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {INDUSTRY_OPTIONS.find(o => o.key === active)?.blurb}
          </p>
        </div>
      </div>
      <div role="radiogroup" className="mt-3 flex flex-wrap gap-2">
        {INDUSTRY_OPTIONS.map(o => {
          const on = active === o.key
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => pickIndustry(o.key)}
              className={`text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                on
                  ? 'border-terracotta/60 bg-terracotta/15 text-terracotta'
                  : 'border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>

      {active === 'healthcare' && (
        <HealthcareFields prefs={prefs} onChange={onChange} />
      )}
      {active === 'warehouse' && (
        <WarehouseFields prefs={prefs} onChange={onChange} />
      )}
      {active === 'restaurant' && (
        <RestaurantFields prefs={prefs} onChange={onChange} />
      )}
      {active === 'trades' && (
        <TradesFields prefs={prefs} onChange={onChange} />
      )}
    </div>
  )
}

function HealthcareFields({ prefs, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
      <NumField
        label="Night / eve $/hr"
        value={prefs.nightDiff ?? 0}
        onChange={v => onChange({ nightDiff: v })}
      />
      <NumField
        label="Weekend $/hr"
        value={prefs.weekendDiff ?? 0}
        onChange={v => onChange({ weekendDiff: v })}
      />
      <NumField
        label="Holiday extra $/hr"
        value={prefs.holidayPremiumPerHour ?? ''}
        placeholder="Half of base if empty"
        allowEmpty
        onChange={v => onChange({ holidayPremiumPerHour: v })}
      />
      <NumField
        label="Charge nurse $/hr"
        value={prefs.chargeNurseDiff ?? 0}
        onChange={v => onChange({ chargeNurseDiff: v })}
      />
      <NumField
        label="Preceptor $/hr"
        value={prefs.preceptorDiff ?? 0}
        onChange={v => onChange({ preceptorDiff: v })}
      />
    </div>
  )
}

function WarehouseFields({ prefs, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
      <NumField
        label="Night shift $/hr"
        value={prefs.nightDiff ?? 0}
        onChange={v => onChange({ nightDiff: v })}
      />
      <NumField
        label="Weekend $/hr"
        value={prefs.weekendDiff ?? 0}
        onChange={v => onChange({ weekendDiff: v })}
      />
      <NumField
        label="Productivity bonus $/hr"
        value={prefs.productivityBonusPerHour ?? 0}
        onChange={v => onChange({ productivityBonusPerHour: v })}
      />
    </div>
  )
}

function RestaurantFields({ prefs, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
      <NumField
        label="Tip credit $/hr"
        value={prefs.tipCreditRate ?? 0}
        onChange={v => onChange({ tipCreditRate: v })}
        placeholder="$2.13 federal floor"
      />
      <NumField
        label="Weekend $/hr"
        value={prefs.weekendDiff ?? 0}
        onChange={v => onChange({ weekendDiff: v })}
      />
    </div>
  )
}

function TradesFields({ prefs, onChange }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-800">
      <NumField
        label="Per-diem $/day"
        value={prefs.perDiemPerDay ?? 0}
        onChange={v => onChange({ perDiemPerDay: v })}
      />
      <NumField
        label="Hazard / fringe $/hr"
        value={prefs.hazardDiffPerHour ?? 0}
        onChange={v => onChange({ hazardDiffPerHour: v })}
      />
      <NumField
        label="Weekend $/hr"
        value={prefs.weekendDiff ?? 0}
        onChange={v => onChange({ weekendDiff: v })}
      />
    </div>
  )
}

function NumField({ label, value, onChange, placeholder, allowEmpty = false }) {
  return (
    <div>
      <label className="block text-[10px] text-slate-500 uppercase mb-1">{label}</label>
      <input
        type="number"
        min="0"
        step="0.25"
        value={value === null ? '' : value}
        placeholder={placeholder || ''}
        onChange={e => {
          const raw = e.target.value
          if (allowEmpty && raw === '') onChange(null)
          else onChange(Number(raw))
        }}
        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1.5 text-sm placeholder:text-slate-600"
      />
    </div>
  )
}

function VerificationBanner({ hasTimesheet, verifiedCount, mismatchCount, unverifiedCount, onGo }) {
  if (!hasTimesheet) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 mb-6 flex items-start gap-3">
        <ShieldQuestion className="w-5 h-5 text-terracotta shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-medium">Back these hours with an employer time record</p>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Upload a Kronos, UKG, Workday, ADP, or Paycom timesheet (or a posted schedule). We match each logged shift
            so the paycheck check runs on hours you can prove, not just what you typed.
          </p>
          <button
            type="button"
            onClick={onGo}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-terracotta hover:text-terracotta-light px-3 py-1.5 rounded-lg border border-terracotta/40 hover:border-terracotta transition-colors"
          >
            Verify hours
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  const tone =
    mismatchCount + unverifiedCount === 0 ? 'border-green-500/25 bg-green-500/5' :
    mismatchCount > 0                     ? 'border-amber-500/25 bg-amber-500/5' :
                                            'border-slate-800 bg-slate-900/60'
  const Icon = mismatchCount + unverifiedCount === 0 ? ShieldCheck : ShieldAlert
  const iconTone = mismatchCount + unverifiedCount === 0 ? 'text-green-400' : 'text-amber-400'

  return (
    <div className={`rounded-2xl border p-4 mb-6 flex items-start gap-3 ${tone}`}>
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconTone}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white font-medium">
          {verifiedCount} verified
          {mismatchCount > 0 && <span className="text-amber-300"> · {mismatchCount} off by a bit</span>}
          {unverifiedCount > 0 && <span className="text-slate-400"> · {unverifiedCount} unmatched</span>}
        </p>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          Matched against your uploaded time record.
          {' '}<button type="button" onClick={onGo} className="text-terracotta hover:underline font-medium">
            Replace or review
          </button>
        </p>
      </div>
    </div>
  )
}

function VerificationPill({ status }) {
  if (!status || status === 'unverified') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 px-1.5 py-0.5 rounded border border-slate-700">
        unverified
      </span>
    )
  }
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-300 px-1.5 py-0.5 rounded border border-green-500/30 bg-green-500/10">
        <ShieldCheck className="w-2.5 h-2.5" />
        verified
      </span>
    )
  }
  if (status === 'mismatch') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10">
        <ShieldAlert className="w-2.5 h-2.5" />
        off by a bit
      </span>
    )
  }
  return null
}
