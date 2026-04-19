import { useEffect, useReducer, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Archive, Search, Download, Trash2, ArrowRight, ArrowUpDown, FileText,
  CalendarDays,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import {
  getPaystubVault, removeStubFromVault, clearVault, savePaystub, savePaystubImage,
} from '../lib/storage'

/**
 * Pay stub vault. A local, searchable archive of every stub the user has uploaded.
 * Use cases: tax time, loan applications, unemployment paperwork, personal record-keeping.
 */

export default function Vault() {
  const navigate = useNavigate()
  const [, bump] = useReducer(n => n + 1, 0)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    const fn = () => bump()
    window.addEventListener('shiftguard-data-changed', fn)
    return () => window.removeEventListener('shiftguard-data-changed', fn)
  }, [])

  const vault = getPaystubVault()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? vault.filter(e => {
          const stub = e.paystub || {}
          return (
            String(stub.employer_name || '').toLowerCase().includes(q) ||
            String(stub.pay_period_start || '').includes(q) ||
            String(stub.pay_period_end || '').includes(q)
          )
        })
      : vault
    if (sort === 'oldest') {
      return [...list].sort((a, b) => String(a.savedAt).localeCompare(b.savedAt))
    }
    if (sort === 'gross') {
      return [...list].sort((a, b) =>
        (Number(b.paystub?.gross_pay) || 0) - (Number(a.paystub?.gross_pay) || 0),
      )
    }
    return list
  }, [vault, query, sort])

  const totals = useMemo(() => {
    const grossSum = vault.reduce((s, e) => s + (Number(e.paystub?.gross_pay) || 0), 0)
    const hoursSum = vault.reduce(
      (s, e) => s + (Number(e.paystub?.hours_paid) || 0) + (Number(e.paystub?.overtime_hours_paid) || 0),
      0,
    )
    const employers = new Set(
      vault.map(e => (e.paystub?.employer_name || '').trim()).filter(Boolean),
    )
    return {
      count: vault.length,
      grossSum,
      hoursSum,
      employers: employers.size,
    }
  }, [vault])

  function openStub(entry) {
    savePaystub(entry.paystub)
    if (entry.imageUrl) savePaystubImage(entry.imageUrl)
    navigate('/compare')
  }

  function onDelete(id) {
    removeStubFromVault(id)
  }

  function exportCsv() {
    const rows = [
      ['Saved at', 'Employer', 'Period start', 'Period end', 'Hours paid', 'OT hours paid', 'Hourly rate', 'Gross', 'Net'],
      ...vault.map(e => {
        const p = e.paystub || {}
        return [
          e.savedAt,
          p.employer_name || '',
          p.pay_period_start || '',
          p.pay_period_end || '',
          p.hours_paid ?? '',
          p.overtime_hours_paid ?? '',
          p.hourly_rate ?? '',
          p.gross_pay ?? '',
          p.net_pay ?? '',
        ]
      }),
    ]
    const csv = rows
      .map(r => r.map(cell => {
        const s = String(cell ?? '')
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `shiftguard-vault-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="relative z-10 flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 pb-24">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/10 px-2.5 py-1 text-[11px] font-medium text-terracotta mb-3">
              <Archive className="w-3.5 h-3.5" />
              Pay stub vault
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
              Every stub, one place
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-2xl mt-1">
              Saved on this device. Pull up any period in seconds for tax prep, loan applications, or
              unemployment paperwork. Export as CSV any time.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              disabled={vault.length === 0}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Remove all stubs from the vault? This cannot be undone.')) clearVault() }}
              disabled={vault.length === 0}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-red-500/30 text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Clear vault
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Stat label="Stubs saved" value={totals.count} />
          <Stat label="Employers" value={totals.employers} />
          <Stat label="Hours on file" value={totals.hoursSum.toFixed(1)} />
          <Stat label="Gross on file" value={`$${totals.grossSum.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`} tone="terracotta" />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by employer or period"
              className="w-full bg-slate-900 border border-slate-800 text-white rounded-lg pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-300">
            <ArrowUpDown className="w-4 h-4 text-slate-500" />
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-terracotta"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="gross">Highest gross</option>
            </select>
          </label>
        </div>

        {vault.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-10 text-center">
            <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-white font-medium">No stubs saved yet</p>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto leading-relaxed">
              Upload a pay stub from the Pay stub tab and it lands here automatically. Everything stays
              on this device unless you explicitly export it.
            </p>
            <Link
              to="/upload"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:text-terracotta-light"
            >
              Upload a pay stub
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(entry => (
              <VaultCard
                key={entry.id}
                entry={entry}
                onOpen={() => openStub(entry)}
                onDelete={() => onDelete(entry.id)}
              />
            ))}
          </ul>
        )}

        <div className="mt-8">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

function VaultCard({ entry, onOpen, onDelete }) {
  const p = entry.paystub || {}
  const period = p.pay_period_start && p.pay_period_end ? `${p.pay_period_start} → ${p.pay_period_end}` : 'Period not set'
  const saved = entry.savedAt ? new Date(entry.savedAt) : null

  return (
    <li className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 flex items-start gap-3 hover:border-slate-700 transition-colors">
      {entry.imageUrl ? (
        <img
          src={entry.imageUrl}
          alt=""
          className="w-14 h-14 object-cover rounded-lg border border-slate-800 shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-slate-500" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{p.employer_name || 'Employer'}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {period}
        </p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          <Field label="Hours" value={`${safe(p.hours_paid) + safe(p.overtime_hours_paid)}h`} />
          <Field label="Rate" value={`$${safe(p.hourly_rate).toFixed(2)}`} />
          <Field label="Gross" value={`$${safe(p.gross_pay).toFixed(2)}`} tone="terracotta" />
        </div>
        {saved && (
          <p className="text-[10px] text-slate-600 mt-2">
            saved {saved.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:text-terracotta-light"
          >
            Open & compare
            <ArrowRight className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-red-300"
            aria-label="Remove from vault"
          >
            <Trash2 className="w-3 h-3" />
            Remove
          </button>
        </div>
      </div>
    </li>
  )
}

function Stat({ label, value, tone }) {
  const cls = tone === 'terracotta' ? 'text-terracotta' : 'text-white'
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.18em]">{label}</p>
      <p className={`mt-0.5 text-xl font-semibold nums ${cls}`}>{value}</p>
    </div>
  )
}

function Field({ label, value, tone }) {
  const cls = tone === 'terracotta' ? 'text-terracotta' : 'text-slate-100'
  return (
    <div>
      <p className="text-[10px] uppercase text-slate-500 tracking-[0.14em]">{label}</p>
      <p className={`mt-0.5 font-semibold nums ${cls}`}>{value}</p>
    </div>
  )
}

function safe(n) { const x = Number(n); return Number.isFinite(x) ? x : 0 }
