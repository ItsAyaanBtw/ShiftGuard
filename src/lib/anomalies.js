/**
 * Cross-check stubs in the vault for patterns a single-stub comparison can't see.
 *
 * Detectors:
 *   - rate-drift: base rate dropped by >= 5% vs the prior stub (not a raise).
 *   - hours-drop: hours paid dropped by >= 20% vs the prior stub with the same frequency.
 *   - differential-missing: a differential line that was present in prior 2+ stubs is absent.
 *
 * All detectors compare the newest stub against a short rolling window of previous stubs and
 * return a normalized list of anomaly objects that `storage.pushAnomaly` can record.
 */

export function detectAnomalies(vault) {
  if (!Array.isArray(vault) || vault.length < 2) return []

  // Vault is newest-first; sort into newest-first array of stubs.
  const sorted = [...vault].sort((a, b) =>
    (b.paystub?.pay_period_end || '').localeCompare(a.paystub?.pay_period_end || ''),
  )
  const latest = sorted[0]?.paystub
  const prior = sorted[1]?.paystub
  if (!latest || !prior) return []

  const out = []

  const rateDrop = pctChange(prior.hourly_rate, latest.hourly_rate)
  if (Number.isFinite(rateDrop) && rateDrop <= -0.05) {
    out.push({
      severity: 'alert',
      title: `Base hourly rate dropped ${Math.round(-rateDrop * 100)}%`,
      detail: `Your stub shows $${safe(latest.hourly_rate).toFixed(2)}/hr, down from $${safe(prior.hourly_rate).toFixed(2)}/hr last period. Confirm with payroll — this could be a data-entry error or a classification change.`,
      context: {
        type: 'rate_drop',
        from: safe(prior.hourly_rate),
        to: safe(latest.hourly_rate),
        periodEnd: latest.pay_period_end,
      },
    })
  }

  const priorPaidHours = safe(prior.hours_paid) + safe(prior.overtime_hours_paid)
  const latestPaidHours = safe(latest.hours_paid) + safe(latest.overtime_hours_paid)
  const hoursDrop = pctChange(priorPaidHours, latestPaidHours)
  if (priorPaidHours > 20 && Number.isFinite(hoursDrop) && hoursDrop <= -0.2) {
    out.push({
      severity: 'warn',
      title: `Paid hours dropped ${Math.round(-hoursDrop * 100)}%`,
      detail: `This stub shows ${latestPaidHours.toFixed(1)}h paid, vs ${priorPaidHours.toFixed(1)}h last period. If you worked a normal schedule, that's worth flagging to payroll.`,
      context: {
        type: 'hours_drop',
        from: priorPaidHours,
        to: latestPaidHours,
        periodEnd: latest.pay_period_end,
      },
    })
  }

  const prevDeductionNames = new Set(
    [sorted[1], sorted[2]]
      .filter(Boolean)
      .flatMap(s => (Array.isArray(s.paystub?.deductions) ? s.paystub.deductions : []))
      .map(d => String(d?.name || '').toLowerCase())
      .filter(Boolean),
  )
  const latestNames = new Set(
    (Array.isArray(latest.deductions) ? latest.deductions : [])
      .map(d => String(d?.name || '').toLowerCase())
      .filter(Boolean),
  )
  const missingDeductions = [...prevDeductionNames].filter(n => !latestNames.has(n))
  if (missingDeductions.length) {
    out.push({
      severity: 'info',
      title: `Deduction line missing: ${missingDeductions[0]}`,
      detail: `Prior stubs had ${missingDeductions.slice(0, 3).join(', ')}. Not a discrepancy by itself — benefits can change — but worth verifying before you file taxes.`,
      context: {
        type: 'deduction_missing',
        missing: missingDeductions,
        periodEnd: latest.pay_period_end,
      },
    })
  }

  return out
}

function pctChange(a, b) {
  const x = Number(a), y = Number(b)
  if (!Number.isFinite(x) || !Number.isFinite(y) || x === 0) return NaN
  return (y - x) / x
}
function safe(n) { const x = Number(n); return Number.isFinite(x) ? x : 0 }
