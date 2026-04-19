/**
 * Integration registry. Each entry exposes the adapter metadata, its connect/verify
 * helpers, and the `importShifts` function the UI calls after the user hits "Sync".
 *
 * We intentionally support a few distinct auth kinds rather than insisting on OAuth:
 *   - 'ical_url'     (Google Calendar, Apple Calendar, Outlook iCal feeds)
 *   - 'token'        (Toggl, Clockify)
 *   - 'json_upload'  (Google Maps Timeline, Takeout JSON)
 *   - 'csv_upload'   (any workforce-management CSV export: When I Work, Deputy,
 *                     Homebase, 7shifts, Sling, etc.)
 *
 * This keeps every integration testable without a real backend, and keeps user secrets
 * on-device (the Vercel edge proxy only relays a single request at a time; nothing is
 * stored server-side).
 */

import * as googleCalendar from './googleCalendar'
import * as googleTimeline from './googleTimeline'
import * as toggl from './toggl'
import * as clockify from './clockify'
import { parseShiftsFromCsv } from './csvImport'
import { buildShiftFromRange, mergeShifts } from './shiftShape'

export const REGISTRY = {
  [googleCalendar.ADAPTER.id]: {
    ...googleCalendar.ADAPTER,
    verify: googleCalendar.fetchEvents,
    importShifts: googleCalendar.importShifts,
    blurb: 'Paste the "Secret iCal address" from your Google Calendar to sync shift events.',
  },
  [googleTimeline.ADAPTER.id]: {
    ...googleTimeline.ADAPTER,
    importShifts: googleTimeline.importShifts,
    blurb: 'Reconstruct workplace arrivals and departures from a Google Takeout Location History JSON file. Parsed locally, never uploaded.',
  },
  [toggl.ADAPTER.id]: {
    ...toggl.ADAPTER,
    verify: toggl.verifyToken,
    importShifts: toggl.importShifts,
    blurb: 'Pull completed time entries from Toggl Track and convert them into shifts.',
  },
  [clockify.ADAPTER.id]: {
    ...clockify.ADAPTER,
    verify: clockify.verifyToken,
    importShifts: clockify.importShifts,
    blurb: 'Pull completed time entries from your Clockify workspace.',
  },
  csv_generic: {
    id: 'csv_generic',
    name: 'Generic CSV',
    kind: 'workforce',
    authType: 'csv_upload',
    connectHelp: 'Works with the CSV exports from When I Work, Deputy, Homebase, 7shifts, Sling, and any other timesheet with date, start, and end columns.',
    blurb: 'Catch-all for any scheduler or timesheet that can export to CSV.',
    importShifts: ({ csv }) => Promise.resolve(parseShiftsFromCsv(csv, { source: 'csv_generic' }).shifts),
  },
}

export function listIntegrations() {
  return Object.values(REGISTRY)
}

export function getAdapter(id) {
  return REGISTRY[id] || null
}

export { buildShiftFromRange, mergeShifts, parseShiftsFromCsv }
