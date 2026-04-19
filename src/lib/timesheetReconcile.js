/**
 * Reconciles a worker's self-reported shifts against an employer-issued time record.
 *
 * The function is pure: it returns a new shift list with a `verification` object
 * attached to each shift, plus summary counts and any timesheet entries that
 * could not be matched (useful for surfacing "missing from your log").
 *
 * Tolerances:
 *   - clock-in / clock-out: default ± 10 minutes
 *   - break length:         default ± 15 minutes
 *   - overnight shifts: if a shift's clock-out is earlier than clock-in (same date),
 *                       we treat clock-out as the following day.
 *
 * Verification statuses:
 *   - 'verified'   : an employer entry matches this shift within tolerance
 *   - 'mismatch'   : an entry matches the date but clock times / breaks are off
 *   - 'unverified' : no entry found for that date
 *   - 'manual'     : the user explicitly marked this shift as employer-confirmed
 *                    without a time record (preserved, never overwritten here)
 */

const DEFAULT_TIME_TOL_MIN = 10
const DEFAULT_BREAK_TOL_MIN = 15

function toMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return null
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function addDaysISO(dateISO, offset) {
  const d = new Date(`${dateISO}T00:00:00`)
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

function shiftSpan(shift) {
  const inMin = toMinutes(shift.clockIn)
  const outMin = toMinutes(shift.clockOut)
  if (inMin == null || outMin == null) return null
  const overnight = outMin <= inMin
  return {
    startDate: shift.date,
    startMin: inMin,
    endDate: overnight ? addDaysISO(shift.date, 1) : shift.date,
    endMin: outMin,
    overnight,
    breakMinutes: Math.max(0, Math.round(Number(shift.breakMinutes) || 0)),
  }
}

function entrySpan(entry) {
  const inMin = toMinutes(entry.in_time)
  const outMin = toMinutes(entry.out_time)
  if (inMin == null || outMin == null) return null
  const overnight = outMin <= inMin
  return {
    startDate: entry.date,
    startMin: inMin,
    endDate: overnight ? addDaysISO(entry.date, 1) : entry.date,
    endMin: outMin,
    overnight,
    breakMinutes: Math.max(0, Math.round(Number(entry.break_minutes) || 0)),
  }
}

function absTimeDelta(a, b) {
  if (!a || !b) return Infinity
  if (a.startDate !== b.startDate) return Infinity
  return Math.abs(a.startMin - b.startMin)
}

function absEndDelta(a, b) {
  if (!a || !b) return Infinity
  if (a.endDate !== b.endDate) return Infinity
  return Math.abs(a.endMin - b.endMin)
}

function scoreMatch(shiftSpanObj, entrySpanObj, tolTime, tolBreak) {
  if (!shiftSpanObj || !entrySpanObj) return null
  const dIn = absTimeDelta(shiftSpanObj, entrySpanObj)
  const dOut = absEndDelta(shiftSpanObj, entrySpanObj)
  const dBreak = Math.abs(shiftSpanObj.breakMinutes - entrySpanObj.breakMinutes)
  const inOk = dIn <= tolTime
  const outOk = dOut <= tolTime
  const breakOk = dBreak <= tolBreak
  return {
    dIn,
    dOut,
    dBreak,
    status: inOk && outOk && breakOk ? 'verified' : 'mismatch',
    reasons: [
      !inOk && `Clock-in off by ${fmtDelta(dIn)}.`,
      !outOk && `Clock-out off by ${fmtDelta(dOut)}.`,
      !breakOk && `Break off by ${Math.abs(dBreak)} min.`,
    ].filter(Boolean),
  }
}

function fmtDelta(mins) {
  if (!Number.isFinite(mins)) return 'more than a day'
  if (mins >= 60) {
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }
  return `${mins} min`
}

/**
 * Greedy one-to-one match: for each shift, pick the best-scoring entry that hasn't been
 * used yet. For a hackathon-grade tool this is more than accurate enough and makes results
 * deterministic.
 */
export function reconcileShifts(shifts, timesheet, options = {}) {
  const tolTime = Number.isFinite(options.timeToleranceMin) ? options.timeToleranceMin : DEFAULT_TIME_TOL_MIN
  const tolBreak = Number.isFinite(options.breakToleranceMin) ? options.breakToleranceMin : DEFAULT_BREAK_TOL_MIN

  const safeShifts = Array.isArray(shifts) ? shifts : []
  const entries = Array.isArray(timesheet?.entries) ? timesheet.entries : []
  if (entries.length === 0) {
    return {
      shifts: safeShifts.map(s => ({
        ...s,
        verification: s.verification?.status === 'manual'
          ? s.verification
          : { status: 'unverified', reasons: [], verifiedAt: null, source: null },
      })),
      summary: { verified: 0, mismatch: 0, unverified: safeShifts.length, extraEntries: 0 },
      extraEntries: [],
    }
  }

  const sourceLabel = timesheet.source_label || 'Employer time record'
  const nowISO = new Date().toISOString()
  const availableEntryIdx = new Set(entries.map((_, i) => i))
  const nextShifts = []
  let verified = 0
  let mismatch = 0
  let unverified = 0

  for (const shift of safeShifts) {
    const sSpan = shiftSpan(shift)
    let bestIdx = -1
    let bestScore = null

    for (const idx of availableEntryIdx) {
      const entry = entries[idx]
      const eSpan = entrySpan(entry)
      if (!sSpan || !eSpan) continue
      if (sSpan.startDate !== eSpan.startDate) continue
      const score = scoreMatch(sSpan, eSpan, tolTime, tolBreak)
      if (!score) continue
      if (!bestScore || totalDelta(score) < totalDelta(bestScore)) {
        bestScore = score
        bestIdx = idx
      }
    }

    if (bestIdx === -1) {
      unverified += 1
      nextShifts.push({
        ...shift,
        verification: shift.verification?.status === 'manual'
          ? shift.verification
          : {
              status: 'unverified',
              reasons: ['No matching entry on this date in the uploaded time record.'],
              verifiedAt: null,
              source: null,
            },
      })
      continue
    }

    availableEntryIdx.delete(bestIdx)
    const status = bestScore.status
    if (status === 'verified') verified += 1
    else mismatch += 1

    nextShifts.push({
      ...shift,
      verification: {
        status,
        reasons: bestScore.reasons,
        verifiedAt: status === 'verified' ? nowISO : null,
        source: sourceLabel,
        entry: entries[bestIdx],
        deltas: {
          inMin: bestScore.dIn,
          outMin: bestScore.dOut,
          breakMin: bestScore.dBreak,
        },
      },
    })
  }

  const extraEntries = [...availableEntryIdx].map(i => entries[i])

  return {
    shifts: nextShifts,
    summary: {
      verified,
      mismatch,
      unverified,
      extraEntries: extraEntries.length,
    },
    extraEntries,
  }
}

function totalDelta(score) {
  return score.dIn + score.dOut + score.dBreak
}

/**
 * Best-effort conversion from a timesheet entry into a ShiftGuard shift draft,
 * useful for the "add missing shifts to my log" action.
 */
export function entryToShiftDraft(entry) {
  return {
    id: crypto?.randomUUID?.() || `entry-${Date.now()}`,
    date: entry.date,
    clockIn: entry.in_time,
    clockOut: entry.out_time,
    breakMinutes: Math.max(0, Math.round(Number(entry.break_minutes) || 0)),
    tips: 0,
    flaggedOT: false,
    shiftType: 'day',
    isWeekend: false,
    isHoliday: false,
    chargeNurse: false,
    preceptor: false,
    onCallHours: 0,
    verification: {
      status: 'verified',
      reasons: [],
      verifiedAt: new Date().toISOString(),
      source: 'Imported from time record',
      entry,
      deltas: { inMin: 0, outMin: 0, breakMin: 0 },
    },
  }
}
