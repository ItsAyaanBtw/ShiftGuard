import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Scale, Briefcase, Gavel, Loader2, Download, Copy, Check,
  ArrowLeft, ArrowRight, ExternalLink, ShieldAlert, AlertTriangle, Info,
  Phone, CheckCircle2
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import AntiRetaliationInfo from '../components/AntiRetaliationInfo'
import { getViolations, getShifts, getPaystub, getUserState, saveDocuments, getDocuments } from '../lib/storage'
import { generateDemandLetter, generateComplaintForm, generateEvidenceSummary } from '../lib/claudeClient'
import stateLaws from '../data/stateLaws'
import { LEGAL_AID_BY_STATE } from '../data/legalResources'

const TABS = [
  { id: 'demand', label: 'Demand Letter', icon: FileText },
  { id: 'complaint', label: 'Complaint', icon: Scale },
  { id: 'evidence', label: 'Evidence', icon: Briefcase },
  { id: 'attorney', label: 'Find Attorney', icon: Gavel },
]

export default function ActionCenter() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('demand')
  const [documents, setDocuments] = useState({ demand: null, complaint: null, evidence: null })
  const [loading, setLoading] = useState({ demand: false, complaint: false, evidence: false })
  const [errors, setErrors] = useState({ demand: null, complaint: null, evidence: null })
  const [copied, setCopied] = useState(null)
  const [workerName, setWorkerName] = useState('')
  const [employerAddress, setEmployerAddress] = useState('')

  const violationData = useMemo(() => getViolations(), [])
  const shifts = useMemo(() => getShifts(), [])
  const paystub = useMemo(() => getPaystub(), [])
  const stateCode = useMemo(() => getUserState(), [])

  const state = stateLaws[stateCode]
  const hasViolations = violationData?.violations?.length > 0

  useEffect(() => {
    const saved = getDocuments()
    if (saved) setDocuments(saved)
  }, [])

  useEffect(() => {
    if (documents.demand || documents.complaint || documents.evidence) {
      saveDocuments(documents)
    }
  }, [documents])

  if (!hasViolations) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No violations to act on</h2>
            <p className="text-slate-400 text-sm mb-6">
              Run the comparison engine first. If violations are detected, you can generate documents here.
            </p>
            <button
              onClick={() => navigate('/compare')}
              className="px-6 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-medium cursor-pointer"
            >
              Go to comparison
            </button>
          </div>
        </div>
      </div>
    )
  }

  const employerName = paystub?.employer_name || ''
  const payPeriod = paystub?.pay_period_start && paystub?.pay_period_end
    ? `${formatDate(paystub.pay_period_start)} to ${formatDate(paystub.pay_period_end)}`
    : ''

  const commonParams = {
    workerName, employerName, employerAddress, payPeriod,
    stateCode, stateName: state.name,
    violations: violationData.violations, totalOwed: violationData.totalOwed,
    agencyName: state.complaintAgency.name, formName: state.complaintAgency.formName,
  }

  async function handleGenerate(tabId) {
    setLoading(prev => ({ ...prev, [tabId]: true }))
    setErrors(prev => ({ ...prev, [tabId]: null }))
    try {
      let text
      if (tabId === 'demand') text = await generateDemandLetter(commonParams)
      else if (tabId === 'complaint') text = await generateComplaintForm(commonParams)
      else text = await generateEvidenceSummary({ ...commonParams, shifts, paystub })
      setDocuments(prev => ({ ...prev, [tabId]: text }))
    } catch (err) {
      console.error(`Failed to generate ${tabId}:`, err)
      setErrors(prev => ({
        ...prev,
        [tabId]: err.message.includes('API') || err.message.includes('timed out')
          ? 'Could not connect to the AI service. Check your API key and try again.'
          : 'Generation failed. Please try again.',
      }))
    } finally {
      setLoading(prev => ({ ...prev, [tabId]: false }))
    }
  }

  async function handleCopy(tabId) {
    if (!documents[tabId]) return
    try {
      await navigator.clipboard.writeText(documents[tabId])
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = documents[tabId]
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopied(tabId)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleDownload(tabId) {
    if (!documents[tabId]) return
    const labels = { demand: 'Demand_Letter', complaint: 'Complaint_Form', evidence: 'Evidence_Summary' }
    const blob = new Blob([documents[tabId]], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ShiftGuard_${labels[tabId]}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Action Center</h1>
          <p className="text-slate-400 text-sm">
            Generate documents to recover ${violationData.totalOwed.toFixed(2)} in potential unpaid wages.
          </p>
        </div>

        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm text-slate-300">
              {violationData.violations.length} violation{violationData.violations.length !== 1 ? 's' : ''} detected
            </span>
            <span className="text-slate-600 mx-2">·</span>
            <span className="text-sm font-semibold text-red-400">${violationData.totalOwed.toFixed(2)} owed</span>
          </div>
          <button onClick={() => navigate('/compare')} className="text-xs text-slate-400 hover:text-slate-200 transition-colors cursor-pointer shrink-0">
            View details
          </button>
        </div>

        <WorkerInfoForm
          workerName={workerName} setWorkerName={setWorkerName}
          employerAddress={employerAddress} setEmployerAddress={setEmployerAddress}
          employerName={employerName}
        />

        {/* Tabs */}
        <div className="flex gap-0.5 bg-slate-900 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer shrink-0 ${
                activeTab === id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
              {id !== 'attorney' && documents[id] && <Check className="w-3 h-3 text-green-400" />}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'attorney' ? (
          <AttorneyReferralPanel stateCode={stateCode} totalOwed={violationData.totalOwed} />
        ) : (
          <DocumentPanel
            tabId={activeTab}
            document={documents[activeTab]}
            loading={loading[activeTab]}
            error={errors[activeTab]}
            copied={copied === activeTab}
            onGenerate={() => handleGenerate(activeTab)}
            onCopy={() => handleCopy(activeTab)}
            onDownload={() => handleDownload(activeTab)}
            agency={state.complaintAgency}
            isComplaint={activeTab === 'complaint'}
          />
        )}

        {activeTab !== 'attorney' && (!documents.demand || !documents.complaint || !documents.evidence) && (
          <button
            onClick={async () => {
              for (const tabId of ['demand', 'complaint', 'evidence']) {
                if (!documents[tabId]) await handleGenerate(tabId)
              }
            }}
            disabled={loading.demand || loading.complaint || loading.evidence}
            className="w-full mt-4 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(loading.demand || loading.complaint || loading.evidence)
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
              : 'Generate all documents'
            }
          </button>
        )}

        {/* Anti-retaliation */}
        <div className="mt-6">
          <AntiRetaliationInfo stateCode={stateCode} />
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate('/compare')}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to comparison
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
          >
            View dashboard <ArrowRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-6"><Disclaimer /></div>
      </main>
    </div>
  )
}

/* ---------- Attorney Referral Panel ---------- */

function AttorneyReferralPanel({ stateCode, totalOwed }) {
  const resources = LEGAL_AID_BY_STATE[stateCode] || []
  const stateName = stateLaws[stateCode]?.name || stateCode

  return (
    <div className="space-y-4">
      {/* FLSA fee-shifting explainer */}
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Gavel className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-white text-sm mb-1">You may not have to pay attorney fees</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Under the FLSA, if you win your wage claim, your employer is required to pay your attorney fees
              on top of the wages they owe you. This is called "fee-shifting," and it means many employment
              attorneys will take wage theft cases on contingency at no upfront cost to you.
            </p>
            {totalOwed >= 500 && (
              <p className="text-sm text-green-400 mt-2 font-medium">
                With ${totalOwed.toFixed(2)} in potential violations, your case is likely strong enough to attract attorney interest.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* What to bring */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">What to bring to a consultation</p>
        <div className="space-y-2">
          {[
            'Your ShiftGuard evidence summary (generate it in the Evidence tab)',
            'Your original pay stubs for the disputed period',
            'Any written communication with your employer about hours or pay',
            'A record of your work schedule (your ShiftGuard shift log)',
            'Names and contact info of coworkers who may have similar issues',
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-terracotta shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300">{item}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Legal aid resources */}
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
          Free and low-cost legal help in {stateName} ({resources.length} organizations)
        </p>
        <div className="space-y-2">
          {resources.map((r, i) => (
            <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-white hover:text-terracotta transition-colors inline-flex items-center gap-1"
                    >
                      {r.name}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    {r.type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 font-medium">{r.type}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{r.focus}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <a
                      href={`tel:${r.phone}`}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      <Phone className="w-3 h-3" />
                      {r.phone}
                    </a>
                    {r.email && (
                      <a
                        href={`mailto:${r.email}`}
                        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        <span className="text-[10px]">@</span>
                        {r.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-slate-800/50 rounded-lg">
        <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          ShiftGuard does not endorse any attorney or organization. These resources are provided
          for informational purposes only. This is not a legal referral. Always verify an
          attorney's credentials and suitability for your case.
        </p>
      </div>
    </div>
  )
}

/* ---------- Worker Info Form ---------- */

function WorkerInfoForm({ workerName, setWorkerName, employerAddress, setEmployerAddress, employerName }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">
        Your information (optional, used in generated documents)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Your name</label>
          <input type="text" value={workerName} onChange={e => setWorkerName(e.target.value)} placeholder="[WORKER NAME]"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-terracotta placeholder:text-slate-600" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Employer name</label>
          <input type="text" value={employerName} disabled
            className="w-full bg-slate-800/50 border border-slate-700 text-slate-400 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-slate-500 mb-1">Employer address (for complaint form)</label>
          <input type="text" value={employerAddress} onChange={e => setEmployerAddress(e.target.value)} placeholder="[EMPLOYER ADDRESS]"
            className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-terracotta placeholder:text-slate-600" />
        </div>
      </div>
    </div>
  )
}

/* ---------- Document Panel ---------- */

function DocumentPanel({ tabId, document, loading, error, copied, onGenerate, onCopy, onDownload, agency, isComplaint }) {
  const descriptions = {
    demand: 'A formal letter to your employer requesting payment of unpaid wages within 10 business days, citing specific statutes and violation amounts.',
    complaint: `A pre-filled template for the ${agency.formName} with ${agency.name}, populated with your violation details.`,
    evidence: 'A structured summary of your case (shift logs, pay stub data, violations, statutes) for an employment attorney consultation.',
  }

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <Loader2 className="w-8 h-8 text-terracotta mx-auto mb-3 animate-spin" />
        <p className="text-white font-medium mb-1">Generating document...</p>
        <p className="text-slate-500 text-sm">This usually takes 10-15 seconds.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-white font-medium mb-1">Generation failed</p>
        <p className="text-slate-400 text-sm mb-4">{error}</p>
        <button onClick={onGenerate} className="px-6 py-2.5 rounded-xl bg-terracotta hover:bg-terracotta-dark text-white transition-colors text-sm font-medium cursor-pointer">
          Try again
        </button>
      </div>
    )
  }

  if (!document) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <p className="text-sm text-slate-400 mb-4">{descriptions[tabId]}</p>
        {isComplaint && agency.url && (
          <a href={agency.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-terracotta hover:text-terracotta-light mb-4 font-medium">
            Official filing page: {agency.name} <ExternalLink className="w-3 h-3" />
          </a>
        )}
        <button onClick={onGenerate}
          className="w-full flex items-center justify-center gap-2 py-3 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer">
          <FileText className="w-4 h-4" />
          Generate {TABS.find(t => t.id === tabId)?.label.toLowerCase()}
        </button>
        <div className="flex items-start gap-2 mt-4">
          <Info className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-600 leading-relaxed">
            This document is generated by AI as an educational template. It is not legal advice
            and has not been reviewed by an attorney. Review carefully and customize before use.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-800/50">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-400" />
          <span className="text-xs font-medium text-slate-400">Generated</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onCopy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button onClick={onDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer">
            <Download className="w-3.5 h-3.5" /> Download
          </button>
          <button onClick={onGenerate} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer">
            Regenerate
          </button>
        </div>
      </div>
      <div className="p-4 max-h-[60vh] overflow-y-auto">
        <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">{document}</pre>
      </div>
      {isComplaint && agency.url && (
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-800/30">
          <a href={agency.url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-terracotta-light font-medium">
            File with {agency.name} <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}
