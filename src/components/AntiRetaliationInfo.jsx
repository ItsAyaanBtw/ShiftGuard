import { useState } from 'react'
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react'
import { ANTI_RETALIATION_INFO } from '../data/legalResources'

export default function AntiRetaliationInfo({ stateCode }) {
  const [open, setOpen] = useState(false)
  const stateInfo = ANTI_RETALIATION_INFO.states[stateCode]

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:bg-slate-800/50 transition-colors"
      >
        <ShieldCheck className="w-5 h-5 text-green-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white">Retaliation: plain-language overview</p>
          <p className="text-xs text-slate-500 mt-0.5">Educational summary only. Not legal advice. {stateCode} context below.</p>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-slate-500 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        }
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
          <div>
            <p className="text-xs font-medium text-green-400 mb-1">{ANTI_RETALIATION_INFO.federal.title}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{ANTI_RETALIATION_INFO.federal.text}</p>
          </div>
          {stateInfo && (
            <div>
              <p className="text-xs font-medium text-green-400 mb-1">{stateInfo.title}</p>
              <p className="text-xs text-slate-400 leading-relaxed">{stateInfo.text}</p>
            </div>
          )}
          <p className="text-xs text-slate-600 pt-1">
            If you think you faced retaliation, keep dated notes and pay records. Your state labor department and the
            federal DOL publish free materials on what to do next.
          </p>
        </div>
      )}
    </div>
  )
}
