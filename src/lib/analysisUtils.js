/**
 * Normalize analysis objects from storage (supports legacy `violations` / `totalOwed`).
 */
export function normalizeAnalysis(raw) {
  if (!raw || typeof raw !== 'object') return null
  const list = Array.isArray(raw.discrepancies)
    ? raw.discrepancies
    : Array.isArray(raw.violations)
      ? raw.violations
      : []

  const discrepancies = list.map(normalizeDiscrepancy)
  const totalDifference = Number(
    raw.totalDifference ?? raw.totalOwed ?? discrepancies.reduce((s, d) => s + d.difference, 0),
  )

  return {
    ...raw,
    discrepancies,
    totalDifference,
    summary: raw.summary || null,
    state: raw.state || null,
  }
}

export function normalizeDiscrepancy(item) {
  if (!item || typeof item !== 'object') {
    return {
      type: 'paycheck_review',
      difference: 0,
      explanation: '',
      suggestedAction: 'Compare your pay advice to your own records.',
      severity: 'low',
    }
  }
  return {
    type: item.type || 'paycheck_review',
    difference: Number(item.difference ?? item.dollarAmount ?? 0),
    explanation: String(item.explanation || ''),
    suggestedAction: String(
      item.suggestedAction ||
        'Review with your manager or payroll. Many issues are simple payroll or timekeeping errors.',
    ),
    severity: ['high', 'medium', 'low'].includes(item.severity) ? item.severity : 'medium',
    lawNote: item.lawNote
      ? String(item.lawNote)
      : item.citation
        ? String(item.citation)
        : undefined,
  }
}

export function analysisHasDiscrepancies(normalized) {
  return !!(normalized?.discrepancies?.length)
}
