import { buildShiftFromRange } from './shiftShape'

/**
 * Google Maps Timeline / Location History importer.
 *
 * Google's Semantic Location History export (Takeout > Location History > Semantic
 * Location History > <year>/<year>_<month>.json) contains `timelineObjects` which include
 * `placeVisit` entries. Each visit has a `location` (latitudeE7, longitudeE7, name, address)
 * and a `duration` (start/end timestamps).
 *
 * We treat each placeVisit above a minimum duration as a candidate shift:
 *   - If the user supplies a place filter (name substring or "lat,lng" with radius), only
 *     visits matching that filter become shifts.
 *   - Otherwise, visits on work-day hours with duration >= `minDurationMinutes` qualify.
 *
 * The importer is fully client-side: the file is parsed locally and never leaves the
 * browser. No proxy needed.
 */

export const ADAPTER = {
  id: 'google_timeline',
  name: 'Google Maps Timeline',
  kind: 'calendar',
  authType: 'json_upload',
  connectHelp: 'Go to takeout.google.com, export "Location History" as JSON, open one of the Semantic Location History month files, and drop it here.',
}

function parseIso(s) {
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.valueOf()) ? null : d
}

function latlngFromE7(loc) {
  if (!loc) return null
  const lat = (loc.latitudeE7 ?? loc.latitude) / (loc.latitudeE7 ? 1e7 : 1)
  const lng = (loc.longitudeE7 ?? loc.longitude) / (loc.longitudeE7 ? 1e7 : 1)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function haversineMeters(a, b) {
  const R = 6371000
  const toRad = d => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa))
}

function collectVisits(parsed) {
  const objects = Array.isArray(parsed?.timelineObjects) ? parsed.timelineObjects : []
  const visits = []
  for (const obj of objects) {
    const v = obj?.placeVisit
    if (!v) continue
    const start = parseIso(v.duration?.startTimestamp)
    const end = parseIso(v.duration?.endTimestamp)
    if (!start || !end) continue
    const loc = latlngFromE7(v.location)
    visits.push({
      start,
      end,
      name: v.location?.name || v.location?.address || '',
      address: v.location?.address || '',
      placeId: v.location?.placeId || '',
      lat: loc?.lat,
      lng: loc?.lng,
    })
  }
  return visits
}

function matchesFilter(visit, filter) {
  if (!filter || !filter.kind || filter.kind === 'none') return true
  if (filter.kind === 'name') {
    const needle = String(filter.value || '').trim().toLowerCase()
    if (!needle) return true
    return visit.name.toLowerCase().includes(needle) || visit.address.toLowerCase().includes(needle)
  }
  if (filter.kind === 'coords') {
    if (!Number.isFinite(visit.lat) || !Number.isFinite(visit.lng)) return false
    const radius = Number(filter.radiusM) || 300
    return haversineMeters({ lat: visit.lat, lng: visit.lng }, { lat: filter.lat, lng: filter.lng }) <= radius
  }
  return true
}

export function parseTimelineJson(text) {
  try {
    return JSON.parse(String(text || ''))
  } catch {
    throw new Error('That file doesn\u2019t look like valid JSON. Use a Semantic Location History month file.')
  }
}

export function importShiftsFromTimeline({
  timelineJson,
  minDurationMinutes = 120,
  placeFilter = null,
  breakMinutes = 0,
}) {
  const parsed = typeof timelineJson === 'string' ? parseTimelineJson(timelineJson) : timelineJson
  const visits = collectVisits(parsed)
  const shifts = []
  let skipped = 0
  for (const v of visits) {
    const minutes = (v.end - v.start) / 60000
    if (minutes < minDurationMinutes) { skipped += 1; continue }
    if (!matchesFilter(v, placeFilter)) { skipped += 1; continue }
    const shift = buildShiftFromRange({
      start: v.start,
      end: v.end,
      breakMinutes,
      source: ADAPTER.id,
      externalId: v.placeId || `${v.start.toISOString()}|${v.name}`,
      label: v.name,
      employer: v.name,
    })
    if (shift) shifts.push(shift)
    else skipped += 1
  }
  return { shifts, skipped, totalVisits: visits.length }
}

export async function importShifts(opts) {
  return importShiftsFromTimeline(opts).shifts
}
