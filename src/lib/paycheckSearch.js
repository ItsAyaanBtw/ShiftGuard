import { getPaystubVault } from './storage'
import { callClaudeText } from './claudeText'

/**
 * Lightweight RAG over the user's saved paystubs. The vault is small (capped at 24
 * entries by storage), so we don't need vector embeddings or external infra. The
 * pattern is:
 *
 *   1. Tokenize the user's prompt into intent signals: dates, employer hints, deduction
 *      keywords, totals.
 *   2. Score every vault entry against the signals (date overlap, employer fuzzy match,
 *      deduction-name presence, dollar-range match).
 *   3. Take the top three records, drop them into a tightly-bounded text prompt for
 *      Claude with strict instructions to answer ONLY from the provided context.
 *
 * "Minimal credits" guarantees:
 *   - Only one model call per question.
 *   - At most three paystub records sent (each ~ 350 tokens).
 *   - max_tokens capped at 700.
 *   - No tool use.
 *
 * The whole pipeline is deterministic and falls back to a "no usable matches" message
 * when the vault is empty or the prompt has no signals.
 */

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

function tokenize(prompt) {
  const lower = String(prompt || '').toLowerCase()
  const tokens = lower.split(/[^a-z0-9$./-]+/).filter(Boolean)

  // Year + month signals.
  const years = (lower.match(/\b20\d{2}\b/g) || []).map(Number)
  const months = []
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (lower.includes(MONTH_NAMES[i])) months.push(i)
  }

  // Dollar amounts in the prompt (for "around $X" type questions).
  const dollarMatches = lower.match(/\$\s?(\d+(?:\.\d+)?)/g) || []
  const dollars = dollarMatches.map(s => Number(s.replace(/[^0-9.]/g, '')))

  // Heuristic intent flags.
  const wantsDeductions = /deduction|withhold|tax|fica|medicare|insurance|401|hsa|garnish|union|dues/i.test(lower)
  const wantsHours = /hour|hr|overtime|ot/i.test(lower)
  const wantsGross = /gross|earned|paid total|paycheck total/i.test(lower)
  const wantsNet = /\bnet\b|take.home|deposit/i.test(lower)
  const wantsLatest = /latest|most recent|last paycheck|last stub/i.test(lower)
  const wantsRange = /between|across|over .* months|past \d+ (months|weeks|paychecks)|year/i.test(lower)

  return { tokens, years, months, dollars, wantsDeductions, wantsHours, wantsGross, wantsNet, wantsLatest, wantsRange }
}

function entryScore(entry, signals) {
  const stub = entry.paystub || {}
  let score = 0
  const start = stub.pay_period_start || ''
  const end = stub.pay_period_end || ''

  if (signals.years.length) {
    if (signals.years.some(y => start.startsWith(String(y)) || end.startsWith(String(y)))) score += 6
  }

  if (signals.months.length) {
    const periodMonths = []
    if (start) periodMonths.push(Number(start.slice(5, 7)) - 1)
    if (end) periodMonths.push(Number(end.slice(5, 7)) - 1)
    if (signals.months.some(m => periodMonths.includes(m))) score += 5
  }

  if (signals.tokens.length) {
    const haystack = `${(stub.employer_name || '').toLowerCase()} ${(stub.notes || '').toLowerCase()}`
    for (const tok of signals.tokens) {
      if (tok.length < 3) continue
      if (haystack.includes(tok)) score += 3
    }
  }

  if (signals.dollars.length) {
    const candidates = [Number(stub.gross_pay), Number(stub.net_pay)].filter(Number.isFinite)
    for (const d of signals.dollars) {
      if (candidates.some(c => Math.abs(c - d) <= Math.max(20, d * 0.1))) score += 4
    }
  }

  // Always give a small recency boost so otherwise-tied paystubs prefer the newer one.
  if (end) {
    const ageDays = Math.max(0, (Date.now() - new Date(`${end}T00:00:00`).valueOf()) / 86400000)
    if (Number.isFinite(ageDays)) score += Math.max(0, 1 - ageDays / 365)
  }

  return score
}

function summarizeEntry(entry) {
  const stub = entry.paystub || {}
  const dedLines = Array.isArray(stub.deductions) ? stub.deductions : []
  return {
    period: stub.pay_period_start && stub.pay_period_end
      ? `${stub.pay_period_start} to ${stub.pay_period_end}`
      : 'period not on stub',
    employer: stub.employer_name || 'unknown employer',
    hoursPaid: Number(stub.hours_paid) || 0,
    overtimeHoursPaid: Number(stub.overtime_hours_paid) || 0,
    hourlyRate: Number(stub.hourly_rate) || 0,
    overtimeRate: Number(stub.overtime_rate) || 0,
    grossPay: Number(stub.gross_pay) || 0,
    tipsReported: Number(stub.tips_reported) || 0,
    netPay: Number(stub.net_pay) || 0,
    deductions: dedLines.map(d => ({ name: String(d?.name || ''), amount: Number(d?.amount) || 0 })),
    savedAt: entry.savedAt || '',
  }
}

export function selectMatches(prompt) {
  const vault = getPaystubVault()
  if (!vault.length) return { matches: [], total: 0 }

  const signals = tokenize(prompt)
  let scored = vault.map(entry => ({ entry, score: entryScore(entry, signals) }))

  // If no signal matched anything, fall back to the most recent three paystubs so the
  // user always gets something useful.
  const anyMatched = scored.some(r => r.score >= 3)
  if (!anyMatched) {
    scored = vault.map(entry => ({ entry, score: 0.5 }))
  }

  scored.sort((a, b) => b.score - a.score)
  const top = scored.slice(0, 3).map(r => summarizeEntry(r.entry))
  return { matches: top, total: vault.length, anyMatched }
}

const SYSTEM_PROMPT = [
  'You are ShiftGuard\u2019s paycheck history assistant.',
  'You answer ONLY using the JSON paystub records provided. If the records do not contain the answer, say so directly and suggest what the user could log next.',
  'Rules:',
  '- Always reference specific pay periods and employer names from the JSON when you cite a number.',
  '- Numbers must be quoted to the cent. Do not estimate beyond what the JSON contains.',
  '- Never invent paystubs or dates the user did not provide.',
  '- Plain-language voice. No legal advice. Avoid em-dashes.',
  '- Three-sentence answers when possible. Bullet only when the user asks for a list.',
].join('\n')

export async function askPaychecks(prompt) {
  const { matches, total, anyMatched } = selectMatches(prompt)
  if (!matches.length) {
    return {
      answer: 'I do not have any paystubs saved yet. Upload one from the Pay stub tab and your history will be searchable here.',
      matches: [],
      total,
      anyMatched: false,
      source: 'empty',
    }
  }

  try {
    const composed = [
      `Question: ${String(prompt || '').trim()}`,
      '',
      'Paystub records (JSON):',
      JSON.stringify(matches, null, 2),
    ].join('\n')

    const text = await callClaudeText(composed, { maxTokens: 700, system: SYSTEM_PROMPT })
    return { answer: text, matches, total, anyMatched, source: 'ai' }
  } catch (err) {
    return {
      answer: `I couldn\u2019t reach the assistant. Here are the matching paystub periods you can look at: ${matches
        .map(m => `${m.employer} (${m.period})`)
        .join('; ')}.`,
      matches,
      total,
      anyMatched,
      source: 'fallback',
      error: err.message || String(err),
    }
  }
}
