import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Printer, AlertTriangle, CheckCircle2, ExternalLink,
  Wrench, Scale, ArrowRight,
} from 'lucide-react'
import Header from '../components/Header'
import Disclaimer from '../components/Disclaimer'
import AntiRetaliationInfo from '../components/AntiRetaliationInfo'
import { getViolations, getShifts, getPaystub, getUserState } from '../lib/storage'
import { normalizeAnalysis } from '../lib/analysisUtils'
import { computeRetroPayEstimate } from '../lib/retroPay'
import stateLaws from '../data/stateLaws'

export default function PaycheckReport() {
  const navigate = useNavigate()
  const analysis = normalizeAnalysis(getViolations())
  const shifts = getShifts()
  const paystub = getPaystub()
  const stateCode = getUserState()
  const state = stateLaws[stateCode] || stateLaws.TX

  if (!analysis?.summary) {
    return (
      <div className="min-h-dvh bg-slate-950 flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Run comparison first</h2>
            <p className="text-slate-400 text-sm mb-6">
              Log your shifts, upload a pay stub, and open Compare to generate a paycheck report.
            </p>
            <button
              type="button"
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

  const { summary, discrepancies, totalDifference } = analysis
  const hasItems = discrepancies.length > 0
  const retro = computeRetroPayEstimate({ stateCode })

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col print:bg-white print:text-black">
      <div className="print:hidden">
        <Header />
      </div>

      <main className="relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 pb-20 print:max-w-none print:py-8">
        <div className="print:hidden mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Your paycheck report</h1>
            <p className="text-slate-400 text-sm">
              A personal summary of your last comparison. Share it with anyone you choose.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/compare')}
            className="shrink-0 flex items-center gap-2 text-sm text-slate-400 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>

        <div
          id="paycheck-report-print"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 print:border-slate-300 print:bg-white print:shadow-none"
        >
          <div className="border-b border-slate-800 print:border-slate-200 pb-6 mb-6">
            <p className="text-xs font-medium text-slate-500 print:text-slate-600 uppercase tracking-wider mb-2">
              ShiftGuard paycheck report
            </p>
            <h2 className="text-xl font-bold text-white print:text-slate-900">
              {paystub?.employer_name || 'Employer'} pay summary
            </h2>
            {paystub?.pay_period_start && paystub?.pay_period_end && (
              <p className="text-sm text-slate-400 print:text-slate-600 mt-1">
                Period {paystub.pay_period_start} to {paystub.pay_period_end}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <ReportStat label="Shifts logged" value={String(shifts.length)} />
            <ReportStat label="Hours worked (logged)" value={`${summary.totalHoursWorked.toFixed(1)}h`} />
            <ReportStat
              label="Hours on pay advice"
              value={`${((paystub?.hours_paid || 0) + (paystub?.overtime_hours_paid || 0)).toFixed(1)}h`}
            />
            <ReportStat label="Gross pay (stub)" value={`$${summary.actualGross.toFixed(2)}`} />
            <ReportStat label="Modeled gross (checks)" value={`$${summary.expectedGross.toFixed(2)}`} />
            <ReportStat label="Line items flagged" value={String(discrepancies.length)} />
          </div>

          {hasItems ? (
            <div className="mb-8">
              <h3 className="text-sm font-semibold text-white print:text-slate-900 mb-3">
                Discrepancies ({discrepancies.length}), about ${totalDifference.toFixed(2)} combined
              </h3>
              <ul className="space-y-4">
                {discrepancies.map((d, i) => (
                  <li
                    key={i}
                    className="rounded-xl border border-slate-800 print:border-slate-200 bg-slate-950/40 print:bg-slate-50 p-4 text-sm"
                  >
                    <div className="flex justify-between gap-2 mb-1">
                      <span className="font-medium text-slate-200 print:text-slate-900 capitalize">
                        {d.type.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-amber-400 print:text-amber-800">
                        ${Number(d.difference).toFixed(2)}
                      </span>
                    </div>
                    <p className="text-slate-400 print:text-slate-700 leading-relaxed">{d.explanation}</p>
                    {d.suggestedAction && (
                      <p className="text-xs text-slate-500 print:text-slate-600 mt-2">
                        <span className="font-medium">Suggested: </span>
                        {d.suggestedAction}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="mb-8 flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-500/5 print:border-green-200 print:bg-green-50 p-4">
              <CheckCircle2 className="w-5 h-5 text-green-400 print:text-green-700 shrink-0" />
              <p className="text-sm text-slate-300 print:text-slate-800">
                No discrepancies were flagged in this run. Keep this report with your records if you want a snapshot
                that nothing triggered the rules we check.
              </p>
            </div>
          )}

          <div className="text-xs text-slate-500 print:text-slate-600 leading-relaxed border-t border-slate-800 print:border-slate-200 pt-6">
            If you believe your paycheck contains errors, most issues can be resolved by discussing with your manager
            or HR. For significant or unresolved issues, your state labor department offers free public resources.
          </div>
        </div>

        <div className="print:hidden mt-8 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 py-3.5 bg-terracotta hover:bg-terracotta-dark text-white font-semibold rounded-xl transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Download PDF
            </button>
            <Link
              to="/tools"
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 transition-colors text-sm font-medium"
            >
              <Wrench className="w-4 h-4" />
              Open the toolkit
            </Link>
          </div>
          <p className="text-[11px] text-slate-600 text-center">
            Uses your browser&apos;s print dialog. Choose &quot;Save as PDF&quot; if you prefer a file.
          </p>
        </div>

        {/* Retro pay anchor banner (only once there is at least one period on file) */}
        {retro.totalInWindow > 0 && (
          <div className="print:hidden mt-8 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-5 flex items-start gap-3">
            <Scale className="w-5 h-5 text-terracotta mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                Across your history, you may be owed about{' '}
                <span className="nums">${retro.totalInWindow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-slate-400 font-normal"> within the {retro.lookbackLabel} {state.name} lookback.</span>
              </p>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Reference: {retro.citation}. Estimate only, not legal advice. Check with your state labor department before acting on this figure.
              </p>
              <Link
                to="/history"
                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-terracotta hover:text-terracotta-light"
              >
                See the full breakdown
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        )}

        <div className="mt-10 print:hidden">
          <AntiRetaliationInfo stateCode={stateCode} />
        </div>

        <section className="mt-10 print:mt-8">
          <h3 className="text-sm font-semibold text-white print:text-slate-900 mb-3">Understanding your rights</h3>
          <p className="text-xs text-slate-500 print:text-slate-600 mb-4 leading-relaxed">
            These links go to official and general educational sources about pay standards. ShiftGuard does not
            endorse third-party articles; read critically and verify with your state.
          </p>
          <ul className="space-y-2">
            <ResourceLink
              href={state.complaintAgency.url}
              label={`${state.complaintAgency.name} (your state)`}
            />
            <ResourceLink href="https://www.dol.gov/agencies/whd" label="U.S. Department of Labor, Wage and Hour Division" />
            <ResourceLink
              href="https://www.nolo.com/legal-encyclopedia/wage-and-hour-laws-29572.html"
              label="Nolo, wage and hour basics (educational)"
            />
            <ResourceLink href="https://www.bls.gov/" label="Bureau of Labor Statistics" />
          </ul>
        </section>

        <div className="mt-10 print:mt-8">
          <Disclaimer />
        </div>
      </main>
    </div>
  )
}

function ReportStat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-slate-500 print:text-slate-500 mb-0.5">{label}</p>
      <p className="text-white print:text-slate-900 font-semibold">{value}</p>
    </div>
  )
}

function ResourceLink({ href, label }) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-terracotta-light print:text-slate-900 print:underline"
      >
        {label}
        <ExternalLink className="w-3.5 h-3.5 print:hidden" />
      </a>
    </li>
  )
}
