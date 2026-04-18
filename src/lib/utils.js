/**
 * Calculate net hours for a single shift, handling overnight shifts.
 * Shared between ShiftLogger UI and comparison engine.
 */
export function calcShiftHours(shift) {
  const [inH, inM] = shift.clockIn.split(':').map(Number)
  const [outH, outM] = shift.clockOut.split(':').map(Number)
  let totalMin = (outH * 60 + outM) - (inH * 60 + inM)
  if (totalMin < 0) totalMin += 24 * 60
  totalMin -= (shift.breakMinutes || 0)
  return Math.max(0, totalMin / 60)
}
