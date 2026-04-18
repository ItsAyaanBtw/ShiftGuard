import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, ArrowRight, Clock, Coffee, DollarSign,
  AlertTriangle, ChevronDown, X, CalendarDays
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import { getShifts, saveShifts, getUserState, saveUserState, getUserCity, saveUserCity } from '../lib/storage'
import { calcShiftHours } from '../lib/utils'
import stateLaws from '../data/stateLaws'

const EMPTY_SHIFT = {
  id: '',
  date: new Date().toISOString().slice(0, 10),
  clockIn: '09:00',
  clockOut: '17:00',
  breakMinutes: 30,
  tips: 0,
  flaggedOT: false,
}

export default function ShiftLogger() {
  const navigate = useNavigate()
  const hydrated = useRef(false)
  const [shifts, setShifts] = useState([])
  const [stateCode, setStateCode] = useState('TX')
  const [city, setCity] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editingShift, setEditingShift] = useState(null)
  const [formData, setFormData] = useState(EMPTY_SHIFT)

  useEffect(() => {
    setShifts(getShifts())
    setStateCode(getUserState())
    setCity(getUserCity())
    hydrated.current = true
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
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

  function openAdd() {
    setEditingShift(null)
    setFormData({ ...EMPTY_SHIFT, id: crypto.randomUUID() })
    setShowForm(true)
  }

  function openEdit(shift) {
    setEditingShift(shift.id)
    setFormData({ ...shift })
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

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Title + state selector */}
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Shift Logger</h1>
            <p className="text-slate-400 text-sm">Log your hours. We'll do the math.</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <StateSelector value={stateCode} onChange={handleStateChange} />
            <CitySelector stateCode={stateCode} value={city} onChange={handleCityChange} />
          </div>
        </div>

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
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-6">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-amber-400 text-sm">
              {totalHours.toFixed(1)} hours logged this pay period. {(totalHours - 40).toFixed(1)} hours may qualify as overtime in {stateLaws[stateCode]?.name}.
            </p>
          </div>
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
          onClick={openAdd}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-700 text-slate-400 hover:border-terracotta hover:text-terracotta transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
          Add shift
        </button>

        {/* Continue to upload */}
        {shifts.length > 0 && (
          <button
            onClick={() => navigate('/upload')}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            Continue to pay stub upload
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
          <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-4 group hover:border-slate-700 transition-colors">
      {/* Date block */}
      <div className="text-center shrink-0 w-14">
        <div className="text-xs text-slate-500 uppercase">{dayName}</div>
        <div className="text-sm font-semibold text-white">{dateStr}</div>
      </div>

      {/* Shift details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm text-white">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>{shift.clockIn} — {shift.clockOut}</span>
          <span className="text-slate-500">·</span>
          <span className="text-terracotta font-medium">{hours.toFixed(1)}h</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
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
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Edit shift"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors cursor-pointer"
          aria-label="Delete shift"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function ShiftFormModal({ formData, setFormData, onSave, onClose, isEditing }) {
  function update(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-6 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit shift' : 'Add shift'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
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
        </div>

        {/* Save */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="flex-1 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-semibold cursor-pointer"
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
