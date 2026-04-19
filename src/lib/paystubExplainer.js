import { callClaudeText } from './claudeText'

/**
 * Paystub Explainer. Turns the normalized paystub record into a plain-language breakdown:
 *   - How the gross was earned (regular + OT hours at the visible rates).
 *   - Every deduction line, classified and explained in the worker's voice ("why you see
 *     this" rather than legalese).
 *   - Hourly-share view: what $X of deductions per hour worked comes out to.
 *   - A confidence note that the parser read the stub correctly.
 *
 * Always returns a structured object the UI renders directly, plus a narrative string
 * sourced from Claude when available (or a deterministic fallback otherwise).
 */

const CATEGORY_RULES = [
  { test: /federal|fed\b|irs/i, category: 'federal_tax', label: 'Federal income tax',
    summary: 'Withheld per your W-4 so you don\u2019t owe a large bill in April. If this is unusually high, your W-4 may have extra withholding lines.' },
  { test: /social security|fica ss|oasdi/i, category: 'ss', label: 'Social Security (FICA)',
    summary: 'A flat 6.2% up to the annual wage base ($176,100 in 2025). The other 6.2% is paid by your employer.' },
  { test: /medicare/i, category: 'medicare', label: 'Medicare',
    summary: '1.45% of every dollar. An extra 0.9% kicks in above $200k single / $250k joint.' },
  { test: /state|suta|disability|sdi|pfl|state unemp/i, category: 'state_tax', label: 'State tax / disability / PFL',
    summary: 'State income tax or state-run disability (SDI) / paid family leave (PFL) contributions, depending on the state.' },
  { test: /city|local|school dist|metro/i, category: 'local_tax', label: 'Local / city tax',
    summary: 'City or local income tax. Common in NYC, Philadelphia, Columbus, and some Ohio and Pennsylvania localities.' },
  { test: /401|403b|tsp|pension|retirement/i, category: 'retirement', label: 'Retirement (401k / 403b)',
    summary: 'Pre-tax contribution lowers your taxable income. Employer match, if any, usually shows on the same line.' },
  { test: /health|medical|dental|vision|insurance|premium/i, category: 'health', label: 'Health, dental, or vision premium',
    summary: 'Your share of the group plan. If this shows as "pre-tax," it\u2019s reducing the gross your income tax is computed on.' },
  { test: /hsa|fsa|dependent care|commuter/i, category: 'pretax_benefit', label: 'HSA, FSA, or commuter benefit',
    summary: 'Pre-tax set-aside for a specific spending category. Lowers your taxable gross.' },
  { test: /union|dues/i, category: 'union_dues', label: 'Union dues',
    summary: 'Collective-bargaining dues per your local. Usually pre-tax on the stub.' },
  { test: /garnish|levy|child support/i, category: 'garnishment', label: 'Garnishment / child support',
    summary: 'Court-ordered withholding. Employer is required to comply until released.' },
  { test: /uniform|meal|parking/i, category: 'post_tax_deduction', label: 'Uniform / meal / parking',
    summary: 'Employer-provided service you\u2019re paying for. Check your offer letter if you didn\u2019t expect this.' },
]

function fmt$(n, d = 2) {
  const v = Number(n) || 0
  return `$${v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
}

export function buildExplainerData(paystub) {
  if (!paystub) return null
  const regularHours = Number(paystub.hours_paid) || 0
  const otHours = Number(paystub.overtime_hours_paid) || 0
  const totalHours = regularHours + otHours
  const rate = Number(paystub.hourly_rate) || 0
  const otRate = Number(paystub.overtime_rate) || 0
  const gross = Number(paystub.gross_pay) || 0
  const net = Number(paystub.net_pay) || 0

  const earningsLines = []
  if (regularHours > 0 && rate > 0) {
    earningsLines.push({
      label: 'Regular hours',
      detail: `${regularHours.toFixed(2)} h at ${fmt$(rate)}/h`,
      amount: regularHours * rate,
    })
  }
  if (otHours > 0 && otRate > 0) {
    earningsLines.push({
      label: 'Overtime hours',
      detail: `${otHours.toFixed(2)} h at ${fmt$(otRate)}/h`,
      amount: otHours * otRate,
    })
  }
  if (Number(paystub.tips_reported) > 0) {
    earningsLines.push({
      label: 'Tips reported',
      detail: 'Tips recorded on this stub.',
      amount: Number(paystub.tips_reported),
    })
  }
  const earningsTotal = earningsLines.reduce((s, l) => s + l.amount, 0)
  const unaccounted = gross - earningsTotal
  if (Math.abs(unaccounted) > 0.5 && gross > 0) {
    earningsLines.push({
      label: 'Other earnings or unexplained gross',
      detail: 'Gross on the stub is higher than regular + OT + tips; could be differentials, bonuses, or retro pay.',
      amount: unaccounted,
    })
  }

  const deductions = Array.isArray(paystub.deductions) ? paystub.deductions : []
  const classifiedDeductions = deductions.map(d => {
    const name = String(d.name || '').trim()
    const amount = Number(d.amount) || 0
    const rule = CATEGORY_RULES.find(r => r.test.test(name))
    return {
      name: name || 'Deduction',
      amount,
      category: rule?.category || 'other_deduction',
      categoryLabel: rule?.label || 'Other deduction',
      summary: rule?.summary || 'Check with payroll if the label on this line doesn\u2019t match anything you recognize.',
    }
  })
  const deductionsTotal = classifiedDeductions.reduce((s, l) => s + l.amount, 0)
  const deductionsPerHour = totalHours > 0 ? deductionsTotal / totalHours : 0
  const netPerHour = totalHours > 0 ? net / totalHours : 0

  return {
    period: {
      employer: paystub.employer_name || 'Employer',
      start: paystub.pay_period_start || '',
      end: paystub.pay_period_end || '',
    },
    hours: { regular: regularHours, overtime: otHours, total: totalHours },
    rates: { regular: rate, overtime: otRate },
    earnings: { lines: earningsLines, total: earningsTotal, gross },
    deductions: { lines: classifiedDeductions, total: deductionsTotal },
    hourly: { grossPerHour: totalHours > 0 ? gross / totalHours : 0, deductionsPerHour, netPerHour },
    net,
    parseConfidence: Number(paystub.parse_confidence) || null,
  }
}

function buildDeterministicNarrative(data) {
  if (!data) return ''
  const { period, hours, earnings, deductions, net, hourly } = data
  const hhNet = hourly.netPerHour > 0 ? `${fmt$(hourly.netPerHour)}/h take-home` : ''
  const lines = [
    `Here\u2019s what the ${period.employer} stub${period.start ? ` for ${period.start}` : ''}${period.end ? ` to ${period.end}` : ''} is telling you.`,
    '',
    `Hours on the stub: ${hours.regular.toFixed(2)} regular, ${hours.overtime.toFixed(2)} overtime, ${hours.total.toFixed(2)} total.`,
    `Earnings roll up to ${fmt$(earnings.gross)} gross. ${earnings.lines.map(l => `${l.label} (${l.detail}) was ${fmt$(l.amount)}`).join('. ')}.`,
    `Deductions total ${fmt$(deductions.total)}.`,
    '',
    'Line-by-line breakdown of the deductions:',
    ...deductions.lines.map(l => `- ${l.name} (${l.categoryLabel}) ${fmt$(l.amount)}. ${l.summary}`),
    '',
    `After everything comes out, you took home ${fmt$(net)}${hhNet ? `, which is ${hhNet} of total hours worked` : ''}.`,
  ]
  return lines.join('\n')
}

function buildAiPrompt(data) {
  return [
    'You are a plain-language paystub explainer. Explain the structured breakdown below to the worker in a warm, direct voice (no jargon, no legal advice).',
    '',
    'Rules:',
    '- Output only the explanation, no preamble.',
    '- Short paragraphs. Use the arrows " -> " to separate ideas when useful.',
    '- Never use em-dashes; use commas or periods.',
    '- Call out each deduction line with its dollar amount and one line on why it exists.',
    '- Close with the take-home and what that works out to per hour.',
    '',
    'Paystub breakdown:',
    JSON.stringify(data, null, 2),
  ].join('\n')
}

export async function explainPaystub(paystub) {
  const data = buildExplainerData(paystub)
  if (!data) return { data: null, narrative: '', source: 'empty' }

  try {
    const narrative = await callClaudeText(buildAiPrompt(data), { maxTokens: 900 })
    if (narrative && narrative.trim().length > 40) {
      return { data, narrative: narrative.trim(), source: 'ai' }
    }
  } catch {
    // fall through to deterministic
  }
  return { data, narrative: buildDeterministicNarrative(data), source: 'template' }
}
