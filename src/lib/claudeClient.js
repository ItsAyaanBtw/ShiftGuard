const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const TIMEOUT_MS = 45_000

async function callClaude(messages, { maxTokens = 2048, retries = 1 } = {}) {
  const headers = { 'Content-Type': 'application/json' }

  if (API_KEY) {
    headers['x-api-key'] = API_KEY
    headers['anthropic-version'] = '2023-06-01'
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: maxTokens,
    messages,
  })

  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      const res = await fetch('/api/claude', {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        const errText = await res.text()
        throw new Error(`API error (${res.status}): ${errText}`)
      }

      const data = await res.json()

      if (!data.content || !data.content[0]?.text) {
        throw new Error('Empty response from AI service')
      }

      return data.content[0].text
    } catch (err) {
      lastError = err
      if (err.name === 'AbortError') {
        lastError = new Error('API request timed out. Please try again.')
      }
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
      }
    }
  }

  throw lastError
}

const PAYSTUB_DEFAULTS = {
  employer_name: '',
  pay_period_start: '',
  pay_period_end: '',
  hours_paid: 0,
  overtime_hours_paid: 0,
  hourly_rate: 0,
  overtime_rate: 0,
  gross_pay: 0,
  deductions: [],
  tips_reported: 0,
  net_pay: 0,
}

function validatePaystubData(raw) {
  const result = { ...PAYSTUB_DEFAULTS }
  if (!raw || typeof raw !== 'object') return result

  result.employer_name = String(raw.employer_name || '')
  result.pay_period_start = String(raw.pay_period_start || '')
  result.pay_period_end = String(raw.pay_period_end || '')
  result.hours_paid = toNum(raw.hours_paid)
  result.overtime_hours_paid = toNum(raw.overtime_hours_paid)
  result.hourly_rate = toNum(raw.hourly_rate)
  result.overtime_rate = toNum(raw.overtime_rate)
  result.gross_pay = toNum(raw.gross_pay)
  result.tips_reported = toNum(raw.tips_reported)
  result.net_pay = toNum(raw.net_pay)

  if (Array.isArray(raw.deductions)) {
    result.deductions = raw.deductions
      .filter(d => d && typeof d === 'object')
      .map(d => ({ name: String(d.name || ''), amount: toNum(d.amount) }))
  }

  return result
}

function toNum(v) {
  const n = parseFloat(v)
  return isNaN(n) ? 0 : n
}

/**
 * Parse a pay stub image using Claude's vision capability.
 */
export async function parsePaystub(imageBase64, mediaType = 'image/jpeg') {
  const prompt = `You are a pay stub parser. Analyze this pay stub image and extract the following data into a JSON object. Be precise with numbers. If a field is not visible or not applicable, use 0 for numbers and "" for strings.

Return ONLY valid JSON with exactly this structure, no markdown, no explanation:
{
  "employer_name": "string",
  "pay_period_start": "YYYY-MM-DD",
  "pay_period_end": "YYYY-MM-DD",
  "hours_paid": 0,
  "overtime_hours_paid": 0,
  "hourly_rate": 0.00,
  "overtime_rate": 0.00,
  "gross_pay": 0.00,
  "deductions": [{"name": "string", "amount": 0.00}],
  "tips_reported": 0.00,
  "net_pay": 0.00
}`

  const text = await callClaude([
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: imageBase64 },
        },
        { type: 'text', text: prompt },
      ],
    },
  ], { retries: 1 })

  const cleaned = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  let parsed
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      parsed = JSON.parse(match[0])
    } else {
      throw new Error('Could not parse AI response as JSON. Try a clearer photo or enter data manually.')
    }
  }

  return validatePaystubData(parsed)
}

import { buildDemandLetter, buildComplaintForm, buildEvidenceSummary } from './documentTemplates'

const hasApiKey = () => API_KEY && API_KEY !== 'your_api_key_here'

/**
 * Generate a demand letter. Uses Claude if API key is configured, otherwise local template.
 */
export async function generateDemandLetter(params) {
  if (!hasApiKey()) return buildDemandLetter(params)

  try {
    const violationList = params.violations
      .map(v => `- ${v.explanation} (${v.citation}): $${v.dollarAmount.toFixed(2)}`)
      .join('\n')

    const prompt = `You are a legal document assistant. Generate a formal demand letter from a worker to their employer regarding unpaid wages. The letter is a template the worker can customize.

Details:
- Worker name: ${params.workerName || '[WORKER NAME]'}
- Employer name: ${params.employerName || '[EMPLOYER NAME]'}
- Pay period: ${params.payPeriod || '[PAY PERIOD]'}
- State: ${params.stateName} (${params.stateCode})
- Total amount owed: $${params.totalOwed.toFixed(2)}
- Violations found:
${violationList}
- State complaint agency: ${params.agencyName}

Requirements:
- Professional, firm tone. Not aggressive, not meek.
- Cite the specific statutes for each violation.
- Request full payment within 10 business days.
- Note the worker's right to file a complaint with ${params.agencyName} and to seek legal counsel.
- Note that under the FLSA, prevailing plaintiffs may recover liquidated damages (double the unpaid wages) plus attorney fees.
- Include today's date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.
- End with signature line for the worker.
- Add a line at the top: "TEMPLATE: NOT LEGAL ADVICE. Review and customize before sending. Consult an attorney."
- Do NOT use em dashes. Use commas or periods instead.
- Keep it to one page (roughly 400-500 words).
- Return plain text only, no markdown formatting.`

    return await callClaude([{ role: 'user', content: prompt }], { maxTokens: 1500 })
  } catch {
    return buildDemandLetter(params)
  }
}

/**
 * Generate a complaint form. Uses Claude if API key is configured, otherwise local template.
 */
export async function generateComplaintForm(params) {
  if (!hasApiKey()) return buildComplaintForm(params)

  try {
    const violationList = params.violations
      .map(v => `- ${v.explanation} (${v.citation}): $${v.dollarAmount.toFixed(2)}`)
      .join('\n')

    const prompt = `You are a legal document assistant. Generate the text content a worker would need to fill out a ${params.formName} with the ${params.agencyName} in ${params.stateName}.

Details:
- Claimant name: ${params.workerName || '[WORKER NAME]'}
- Employer name: ${params.employerName || '[EMPLOYER NAME]'}
- Employer address: ${params.employerAddress || '[EMPLOYER ADDRESS]'}
- Pay period in dispute: ${params.payPeriod || '[PAY PERIOD]'}
- Total wages owed: $${params.totalOwed.toFixed(2)}
- Violations:
${violationList}

Requirements:
- Format as labeled fields the worker can copy into the actual complaint form.
- Include: claimant info section, employer info section, description of violations, wages claimed, dates of employment.
- Write the "description of claim" narrative in first person, clearly and factually.
- Cite specific statutes.
- Note this is for the ${params.formName} filed with ${params.agencyName}.
- Add a line at the top: "TEMPLATE: NOT LEGAL ADVICE. Use this as a guide when filling out the official ${params.formName}."
- Do NOT use em dashes.
- Return plain text only, no markdown.`

    return await callClaude([{ role: 'user', content: prompt }], { maxTokens: 1500 })
  } catch {
    return buildComplaintForm(params)
  }
}

/**
 * Generate an evidence summary. Uses Claude if API key is configured, otherwise local template.
 */
export async function generateEvidenceSummary(params) {
  if (!hasApiKey()) return buildEvidenceSummary(params)

  try {
    const violationList = params.violations
      .map(v => `- [${v.severity.toUpperCase()}] ${v.type}: ${v.explanation} (${v.citation}): $${v.dollarAmount.toFixed(2)}`)
      .join('\n')

    const shiftLog = params.shifts
      .map(s => `  ${s.date}: ${s.clockIn}-${s.clockOut}, break ${s.breakMinutes}min, tips $${Number(s.tips || 0).toFixed(2)}${s.flaggedOT ? ' [OT flagged]' : ''}`)
      .join('\n')

    const prompt = `You are a legal document assistant. Generate a concise evidence summary report that a worker can bring to an employment attorney consultation.

Case details:
- Worker: ${params.workerName || '[WORKER NAME]'}
- Employer: ${params.employerName || '[EMPLOYER NAME]'}
- Pay period: ${params.payPeriod || '[PAY PERIOD]'}
- State: ${params.stateName} (${params.stateCode})
- Total estimated wages owed: $${params.totalOwed.toFixed(2)}

Violations detected:
${violationList}

Shift log (worker-reported):
${shiftLog}

Pay stub data:
- Hours paid: ${params.paystub.hours_paid}, OT hours paid: ${params.paystub.overtime_hours_paid}
- Hourly rate: $${params.paystub.hourly_rate}, OT rate: $${params.paystub.overtime_rate}
- Gross pay: $${params.paystub.gross_pay}, Net pay: $${params.paystub.net_pay}

Requirements:
- Organize into sections: Case Summary, Violations Detected (with statutes and amounts), Worker Shift Log, Pay Stub Summary, Recommended Legal Actions.
- Present facts clearly and concisely. An attorney should be able to assess the case in under 2 minutes.
- Include the total amount in controversy and applicable statutes.
- Note FLSA fee-shifting (employer pays attorney fees for prevailing plaintiffs).
- Note the statute of limitations: 2 years for FLSA (3 years if willful), and relevant state deadlines.
- Add a header: "EVIDENCE SUMMARY, Prepared by ShiftGuard (educational tool, not legal advice)"
- Generated on: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
- Do NOT use em dashes.
- Return plain text only, no markdown.`

    return await callClaude([{ role: 'user', content: prompt }], { maxTokens: 2000 })
  } catch {
    return buildEvidenceSummary(params)
  }
}
