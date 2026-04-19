/**
 * Drafts a factual, scrivener-style pay-discrepancy email from the user's own comparison
 * data. Uses Claude when available and falls back to a deterministic template otherwise.
 *
 * Framing: ShiftGuard is not a law firm. The email is the USER's own words, captured and
 * formatted. No legal conclusions, no demand-letter language, no attorney-client shimmer.
 * Subject line and body read like a normal employee asking payroll to double-check.
 */

import { callClaudeText } from './claudeText'

function fmtUSD(n) { return `$${(Number(n) || 0).toFixed(2)}` }

function detailLine(d) {
  const t = String(d.type || 'pay discrepancy').replace(/_/g, ' ')
  const amt = Number(d.difference ?? d.dollarAmount ?? 0)
  const explanation = String(d.explanation || '').trim()
  const action = d.suggestedAction ? ` ${String(d.suggestedAction).trim()}` : ''
  return `- ${t[0].toUpperCase()}${t.slice(1)}: ${fmtUSD(amt)}. ${explanation}${action}`
}

function buildDeterministicDraft({ workerName, payPeriod, discrepancies = [], totalDifference = 0, stateName }) {
  const worker = workerName || '[Your name]'
  const period = payPeriod || '[pay period]'
  const total = fmtUSD(totalDifference)
  const detail = discrepancies.length
    ? discrepancies.map(detailLine).join('\n')
    : '- (no line items)'

  const subject = `Quick check on my paycheck for ${period}`

  const body = [
    `Hi Payroll,`,
    ``,
    `I was reviewing my pay stub for ${period} alongside my shift log and noticed a few things I'd like to check with you.`,
    ``,
    `Based on my records, I may be owed approximately ${total} in total. The line items I'd like to confirm:`,
    ``,
    detail,
    ``,
    `Could you take a look and let me know what I'm missing, or confirm the calculation on your end? Happy to share copies of my shift log and the pay stub if that helps.`,
    ``,
    stateName ? `For context, I'm checking this against the usual ${stateName} and federal pay rules; I may have misread something.` : `I may have misread something on my end, so I want to make sure before I ask anything further.`,
    ``,
    `Thanks,`,
    worker,
  ].join('\n')

  return { subject, body }
}

/**
 * Public entry point. Returns { subject, body, source: 'ai' | 'template' }.
 * Always succeeds — if the AI call fails, the deterministic template is returned.
 */
export async function draftPayDiscrepancyEmail(params) {
  const cleaned = cleanParams(params)
  const template = () => buildDeterministicDraft(cleaned)

  // Refuse to call the model with nothing to say.
  if (!cleaned.discrepancies.length) {
    const d = template()
    return { ...d, source: 'template' }
  }

  try {
    const prompt = buildAiPrompt(cleaned)
    const text = await callClaudeText(prompt, { maxTokens: 900 })
    const parsed = parseSubjectBody(text)
    if (!parsed.body.trim()) throw new Error('Empty draft from scanning service.')
    return { ...parsed, source: 'ai' }
  } catch {
    const d = template()
    return { ...d, source: 'template' }
  }
}

/** Convenience: same as draftPayDiscrepancyEmail but never calls the network. */
export function draftPayDiscrepancyEmailLocal(params) {
  return { ...buildDeterministicDraft(cleanParams(params)), source: 'template' }
}

function cleanParams(params = {}) {
  const discrepancies = Array.isArray(params.discrepancies)
    ? params.discrepancies.map(d => ({
        type: String(d?.type || 'pay_discrepancy'),
        difference: Number(d?.difference ?? d?.dollarAmount ?? 0),
        explanation: String(d?.explanation || ''),
        suggestedAction: String(d?.suggestedAction || ''),
        severity: ['high', 'medium', 'low'].includes(d?.severity) ? d.severity : 'medium',
      }))
    : []
  const totalDifference = Number.isFinite(params.totalDifference)
    ? Number(params.totalDifference)
    : discrepancies.reduce((s, d) => s + (Number(d.difference) || 0), 0)

  return {
    workerName: String(params.workerName || '').trim(),
    employerName: String(params.employerName || '').trim(),
    payPeriod: String(params.payPeriod || '').trim(),
    stateName: String(params.stateName || '').trim(),
    discrepancies,
    totalDifference,
  }
}

function buildAiPrompt({ workerName, employerName, payPeriod, discrepancies, totalDifference, stateName }) {
  const lines = discrepancies.map(detailLine).join('\n')
  return [
    'You are drafting an employee-to-payroll email on behalf of the worker below. You are a scrivener: you transcribe THEIR own facts into a short professional email in their voice. Do not give legal advice, do not use demand-letter language, do not threaten. Ask payroll to double-check the line items.',
    '',
    'Rules:',
    '- Output strictly two fields, on separate lines, nothing else:',
    '    Subject: <one short subject line>',
    '    Body: <the email body, plain text only, 140-220 words>',
    '- Use a warm, direct tone ("I noticed", "could you check"). No exclamation marks.',
    '- Never claim anything was "stolen", "owed by law", "wage theft", or "illegal". Say "may be owed" and "I may have misread something".',
    '- Do not include signatures beyond the worker\'s name.',
    '- Do not use em-dashes; use commas or periods.',
    '',
    `Worker: ${workerName || '[name not provided]'}`,
    `Employer: ${employerName || '(unnamed)'}`,
    `Pay period: ${payPeriod || '(not provided)'}`,
    `State context: ${stateName || '(not provided)'}`,
    `Approx. total to confirm: ${fmtUSD(totalDifference)}`,
    '',
    'Line items the worker wants payroll to verify:',
    lines,
  ].join('\n')
}

function parseSubjectBody(text) {
  const trimmed = String(text || '').trim()
  const subjMatch = trimmed.match(/^Subject:\s*(.+)$/im)
  const bodyMatch = trimmed.match(/^Body:\s*([\s\S]+)$/im)
  if (subjMatch && bodyMatch) {
    return {
      subject: subjMatch[1].trim(),
      body: bodyMatch[1].replace(/^Subject:.*$/im, '').trim(),
    }
  }
  // Fallback: split first line as subject if no labels.
  const [first, ...rest] = trimmed.split('\n')
  return {
    subject: first.replace(/^subject[:-]\s*/i, '').trim().slice(0, 120),
    body: rest.join('\n').trim() || trimmed,
  }
}
