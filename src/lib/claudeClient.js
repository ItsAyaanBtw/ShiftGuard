/**
 * Claude client with two call paths:
 *   1) Direct browser call to api.anthropic.com when VITE_ANTHROPIC_API_KEY is present.
 *      This is the local-dev-friendly path. Requires the header
 *      "anthropic-dangerous-direct-browser-access: true" that Anthropic added in Aug 2024.
 *   2) Vercel Edge proxy at /api/claude (reads ANTHROPIC_API_KEY server-side).
 *      This is the production path and keeps the key off the client.
 *
 * The client prefers direct calls when it has a key; otherwise it falls back to the proxy.
 * Callers never have to know which path was used.
 */

const DIRECT_KEY = (import.meta.env.VITE_ANTHROPIC_API_KEY || '').trim()
const MODEL = (import.meta.env.VITE_ANTHROPIC_MODEL || 'claude-sonnet-4-6-20250514').trim()
const TIMEOUT_MS = 60_000
const PLACEHOLDER_KEYS = new Set(['', 'your_api_key_here', 'sk-ant-api03-REPLACE_ME'])

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

const TIMESHEET_DEFAULTS = {
  source_label: '',
  employer_name: '',
  employee_name: '',
  period_start: '',
  period_end: '',
  parse_confidence: 0,
  notes: '',
  entries: [],
}

function toNum(v) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : 0
}

function clampConfidence(v) {
  const n = toNum(v)
  if (n <= 0) return 0
  if (n >= 1) return 1
  return n
}

function normalizeStr(v) {
  return typeof v === 'string' ? v.trim() : ''
}

function hasDirectKey() {
  if (!DIRECT_KEY || PLACEHOLDER_KEYS.has(DIRECT_KEY)) return false
  return DIRECT_KEY.length >= 20
}

/**
 * True if EITHER the direct browser key or the server proxy is reachable.
 * (We can't synchronously know about the proxy, so we assume "yes" and let the
 * first request surface a 500 with type:'config' if it isn't.)
 */
export function hasAnthropicApiKey() {
  return true
}

/* -------------------------------------------------------------------------- */
/*  Low-level call                                                             */
/* -------------------------------------------------------------------------- */

export async function callClaude(requestBody, { retries = 1 } = {}) {
  const bodyText = JSON.stringify({ model: MODEL, ...requestBody })
  let lastError

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      let res
      if (hasDirectKey()) {
        res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': DIRECT_KEY,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
          body: bodyText,
          signal: controller.signal,
        })
      } else {
        res = await fetch('/api/claude', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyText,
          signal: controller.signal,
        })
      }
      clearTimeout(timer)

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        let msg = `API error ${res.status}`
        if (errText) {
          try {
            const j = JSON.parse(errText)
            const anthropicMsg = j?.error?.message || (typeof j?.error === 'string' ? j.error : '')
            // Any variant of "missing / invalid key" collapses to one clean user-facing string.
            if (
              j.type === 'config' ||
              (typeof j?.error === 'string' && /ANTHROPIC_API_KEY/i.test(j.error)) ||
              /x-api-key header is required|invalid x-api-key|authentication_error/i.test(anthropicMsg)
            ) {
              const err = new Error(
                'The assistant is not configured on this device. Add ANTHROPIC_API_KEY (or VITE_ANTHROPIC_API_KEY) to .env.local and restart the dev server. You can keep using everything else on this page.',
              )
              err.code = 'unconfigured'
              throw err
            }
            if (anthropicMsg) msg = anthropicMsg
          } catch (innerErr) {
            if (innerErr.code === 'unconfigured') throw innerErr
            msg += `: ${errText.slice(0, 200)}`
          }
        }
        throw new Error(msg)
      }

      const data = await res.json()
      if (data?.error) {
        const serverMsg = typeof data.error === 'string' ? data.error : data.error.message || 'Assistant returned an error'
        if (/x-api-key header is required|invalid x-api-key|authentication_error|ANTHROPIC_API_KEY/i.test(serverMsg)) {
          const err = new Error(
            'The assistant is not configured on this device. Add ANTHROPIC_API_KEY to .env.local and restart the dev server.',
          )
          err.code = 'unconfigured'
          throw err
        }
        throw new Error(serverMsg)
      }
      return data
    } catch (err) {
      clearTimeout(timer)
      lastError = err.name === 'AbortError' ? new Error('Request timed out. Please try again.') : err
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 800 * (attempt + 1)))
      }
    }
  }

  throw lastError
}

/**
 * Find the tool_use block in a Claude response and return its structured input.
 * Falls back to text-JSON extraction if the model refused to call the tool.
 */
function extractToolInput(response, toolName) {
  const blocks = Array.isArray(response?.content) ? response.content : []
  const toolBlock = blocks.find(b => b?.type === 'tool_use' && (!toolName || b.name === toolName))
  if (toolBlock && toolBlock.input && typeof toolBlock.input === 'object') {
    return toolBlock.input
  }

  const textBlock = blocks.find(b => b?.type === 'text' && typeof b.text === 'string')
  if (!textBlock) throw new Error('The scanning service returned no usable content.')
  const cleaned = textBlock.text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
    throw new Error('The response was not valid JSON. Try again with a clearer image.')
  }
}

/* -------------------------------------------------------------------------- */
/*  Tool schemas                                                                */
/* -------------------------------------------------------------------------- */

const PAYSTUB_TOOL = {
  name: 'record_paystub',
  description:
    'Record every numeric field extracted from a US pay stub. Use null for anything you cannot read with confidence.',
  input_schema: {
    type: 'object',
    properties: {
      employer_name: { type: 'string', description: 'Name of the employer as printed.' },
      pay_period_start: { type: 'string', description: 'Pay period start in YYYY-MM-DD; empty string if not visible.' },
      pay_period_end: { type: 'string', description: 'Pay period end in YYYY-MM-DD; empty string if not visible.' },
      hours_paid: { type: 'number', description: 'Regular hours paid (not overtime). 0 if not visible.' },
      overtime_hours_paid: { type: 'number', description: 'Overtime hours paid on the stub. 0 if not visible.' },
      hourly_rate: { type: 'number', description: 'Base hourly rate in dollars. 0 if not hourly.' },
      overtime_rate: { type: 'number', description: 'Overtime hourly rate in dollars. 0 if not shown.' },
      gross_pay: { type: 'number', description: 'Total gross pay for the period.' },
      tips_reported: { type: 'number', description: 'Tips reported on this stub. 0 if none.' },
      net_pay: { type: 'number', description: 'Net (take-home) pay for the period.' },
      deductions: {
        type: 'array',
        description: 'Every pre-tax, tax, and post-tax deduction line.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'number' },
          },
          required: ['name', 'amount'],
        },
      },
      parse_confidence: {
        type: 'number',
        description: '0.0 to 1.0 self-reported confidence. Use < 0.5 for blurry or non-stub images.',
      },
      notes: {
        type: 'string',
        description: 'Short note if anything looked unusual, missing, or ambiguous.',
      },
    },
    required: ['employer_name', 'hours_paid', 'hourly_rate', 'gross_pay'],
  },
}

const TIMESHEET_TOOL = {
  name: 'record_timesheet',
  description:
    'Record clock-in and clock-out punches from an employer-issued time record (Kronos, UKG, Workday, ADP, Paycom, Dayforce, Paylocity, Oracle, a posted schedule, or similar).',
  input_schema: {
    type: 'object',
    properties: {
      source_label: {
        type: 'string',
        description: 'Short label for the document (e.g., "Kronos Timecard", "Workday Time Tracking", "Posted schedule").',
      },
      employer_name: { type: 'string' },
      employee_name: { type: 'string' },
      period_start: { type: 'string', description: 'YYYY-MM-DD if a period range is visible. Empty string otherwise.' },
      period_end: { type: 'string' },
      parse_confidence: {
        type: 'number',
        description: '0.0 to 1.0. Use < 0.5 for unreadable documents or non-time-record images.',
      },
      notes: { type: 'string' },
      entries: {
        type: 'array',
        description: 'One entry per shift or punch pair. Overnight shifts should use the DATE OF CLOCK-IN.',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'YYYY-MM-DD (clock-in date).' },
            in_time: { type: 'string', description: 'HH:MM in 24h local time.' },
            out_time: { type: 'string', description: 'HH:MM in 24h local time.' },
            break_minutes: { type: 'number', description: 'Total unpaid break minutes. 0 if none.' },
            department: { type: 'string' },
            shift_notes: { type: 'string' },
          },
          required: ['date', 'in_time', 'out_time'],
        },
      },
    },
    required: ['entries', 'parse_confidence'],
  },
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Parse a pay stub image. Uses forced tool use for reliable structured output.
 */
export async function parsePaystub(imageBase64, mediaType = 'image/jpeg') {
  if (!imageBase64) {
    throw new Error('No image data to scan.')
  }

  const systemPrompt =
    'You extract numeric fields from US pay stubs. Rules: (1) Always call record_paystub. ' +
    '(2) Use null or 0 for fields you cannot read confidently. (3) Never invent numbers. ' +
    '(4) Strip currency symbols and commas. (5) Dates in YYYY-MM-DD. (6) Redact SSN and ' +
    'full bank account numbers. (7) If the image is not a pay stub, call the tool with ' +
    'parse_confidence < 0.3 and a short note.'

  const response = await callClaude({
    max_tokens: 2048,
    system: systemPrompt,
    tools: [PAYSTUB_TOOL],
    tool_choice: { type: 'tool', name: PAYSTUB_TOOL.name },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: normalizeMediaType(mediaType), data: imageBase64 },
          },
          { type: 'text', text: 'Extract every field from this pay stub.' },
        ],
      },
    ],
  })

  return validatePaystubData(extractToolInput(response, PAYSTUB_TOOL.name))
}

/**
 * Parse an employer-issued timesheet (image or PDF). Returns a normalized timesheet record
 * that callers then reconcile against self-reported shifts.
 */
export async function parseTimesheet(fileBase64, mediaType = 'image/jpeg') {
  const systemPrompt =
    'You extract clock-in/clock-out punches from US employer time records. Rules: ' +
    '(1) Always call record_timesheet. (2) Times in HH:MM 24h local. Infer AM/PM when an ' +
    'AM/PM column is present. (3) Overnight shifts: use the clock-in date. (4) Do not ' +
    'fabricate entries. If the document is not a time record, call the tool with ' +
    'parse_confidence < 0.3 and explain in notes.'

  const isPdf = /pdf/i.test(mediaType)
  const normalizedMedia = isPdf ? 'application/pdf' : normalizeMediaType(mediaType)
  const contentBlock = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: fileBase64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: normalizedMedia, data: fileBase64 },
      }

  const response = await callClaude({
    max_tokens: 4096,
    system: systemPrompt,
    tools: [TIMESHEET_TOOL],
    tool_choice: { type: 'tool', name: TIMESHEET_TOOL.name },
    messages: [
      {
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: 'List every shift or punch pair you can read from this time record.',
          },
        ],
      },
    ],
  })

  return validateTimesheetData(extractToolInput(response, TIMESHEET_TOOL.name))
}

/* -------------------------------------------------------------------------- */
/*  Validators                                                                  */
/* -------------------------------------------------------------------------- */

function normalizeMediaType(mediaType) {
  const m = String(mediaType || '').toLowerCase()
  if (m === 'image/jpg') return 'image/jpeg'
  if (m.startsWith('image/')) return m
  return 'image/jpeg'
}

function validatePaystubData(raw) {
  const result = { ...PAYSTUB_DEFAULTS }
  if (!raw || typeof raw !== 'object') return result

  result.employer_name = normalizeStr(raw.employer_name)
  result.pay_period_start = normalizeStr(raw.pay_period_start)
  result.pay_period_end = normalizeStr(raw.pay_period_end)
  result.hours_paid = toNum(raw.hours_paid)
  result.overtime_hours_paid = toNum(raw.overtime_hours_paid)
  result.hourly_rate = toNum(raw.hourly_rate)
  result.overtime_rate = toNum(raw.overtime_rate)
  result.gross_pay = toNum(raw.gross_pay)
  result.tips_reported = toNum(raw.tips_reported)
  result.net_pay = toNum(raw.net_pay)
  result.parse_confidence = clampConfidence(raw.parse_confidence)
  result.notes = normalizeStr(raw.notes)

  if (Array.isArray(raw.deductions)) {
    result.deductions = raw.deductions
      .filter(d => d && typeof d === 'object')
      .map(d => ({ name: normalizeStr(d.name), amount: toNum(d.amount) }))
  }

  return result
}

function validateTimesheetData(raw) {
  const result = { ...TIMESHEET_DEFAULTS }
  if (!raw || typeof raw !== 'object') return result

  result.source_label = normalizeStr(raw.source_label)
  result.employer_name = normalizeStr(raw.employer_name)
  result.employee_name = normalizeStr(raw.employee_name)
  result.period_start = normalizeStr(raw.period_start)
  result.period_end = normalizeStr(raw.period_end)
  result.parse_confidence = clampConfidence(raw.parse_confidence)
  result.notes = normalizeStr(raw.notes)

  if (Array.isArray(raw.entries)) {
    result.entries = raw.entries
      .filter(e => e && typeof e === 'object' && e.date && e.in_time && e.out_time)
      .map(e => ({
        date: normalizeStr(e.date),
        in_time: normalizeStr(e.in_time),
        out_time: normalizeStr(e.out_time),
        break_minutes: Math.max(0, Math.round(toNum(e.break_minutes))),
        department: normalizeStr(e.department),
        shift_notes: normalizeStr(e.shift_notes),
      }))
  }

  return result
}

/* -------------------------------------------------------------------------- */
/*  Legacy document generators (kept as deterministic-only stubs for templates) */
/* -------------------------------------------------------------------------- */
/*  Legacy-doc helpers removed by design. ShiftGuard never generates demand     */
/*  letters, complaint forms, attorney referrals, or anything else that looks   */
/*  like legal advice. Long-form text features that remain (paycheck Q&A) live  */
/*  the single supported long-form output: a respectful inquiry email.          */
/* -------------------------------------------------------------------------- */
