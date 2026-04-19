/**
 * Integration registry. Each entry exposes the adapter metadata, its connect/verify
 * helpers, and the `importShifts` function the UI calls after the user hits "Sync".
 *
 * We intentionally support a few distinct auth kinds rather than insisting on OAuth:
 *   - 'ical_url'           (Google Calendar, Apple Calendar, generic .ics feed)
 *   - 'token'              (Calendly, Toggl, Clockify)
 *   - 'token_and_account'  (Harvest: PAT + account ID)
 *   - 'csv_upload'         (When I Work, Deputy, Homebase, 7shifts, Sling, etc.)
 *
 * This keeps every integration testable without a real backend, and keeps user secrets
 * on-device (the Vercel edge proxy only relays a single request at a time; nothing is
 * stored server-side).
 */

import * as googleCalendar from './googleCalendar'
import * as calendly from './calendly'
import * as toggl from './toggl'
import * as clockify from './clockify'
import * as harvest from './harvest'
import { parseShiftsFromCsv } from './csvImport'
import { buildShiftFromRange, mergeShifts } from './shiftShape'

/** Every registered adapter, keyed by id. */
export const REGISTRY = {
  [googleCalendar.ADAPTER.id]: {
    ...googleCalendar.ADAPTER,
    verify: googleCalendar.fetchEvents,
    importShifts: googleCalendar.importShifts,
    blurb: 'Pull your shift calendar by pasting a "Secret iCal address" URL.',
  },
  [calendly.ADAPTER.id]: {
    ...calendly.ADAPTER,
    verify: calendly.verifyToken,
    importShifts: calendly.importShifts,
    blurb: 'Great for home-health, consulting, and tutoring workers who schedule through Calendly.',
  },
  [toggl.ADAPTER.id]: {
    ...toggl.ADAPTER,
    verify: toggl.verifyToken,
    importShifts: toggl.importShifts,
    blurb: 'Pull completed time entries from Toggl Track and turn them into shifts.',
  },
  [clockify.ADAPTER.id]: {
    ...clockify.ADAPTER,
    verify: clockify.verifyToken,
    importShifts: clockify.importShifts,
    blurb: 'Pull completed time entries from Clockify workspaces.',
  },
  [harvest.ADAPTER.id]: {
    ...harvest.ADAPTER,
    verify: harvest.verifyToken,
    importShifts: harvest.importShifts,
    blurb: 'Pull time entries from Harvest (accepts the hours-only format too).',
  },
  csv_wheniwork: {
    id: 'csv_wheniwork',
    name: 'When I Work (CSV)',
    kind: 'workforce',
    authType: 'csv_upload',
    connectHelp: 'In When I Work, export a timesheet or schedule CSV, then drag the file in here.',
    blurb: 'Works with the standard When I Work schedule or timesheet export.',
    importShifts: ({ csv }) => Promise.resolve(parseShiftsFromCsv(csv, { source: 'csv_wheniwork' }).shifts),
  },
  csv_deputy: {
    id: 'csv_deputy',
    name: 'Deputy (CSV)',
    kind: 'workforce',
    authType: 'csv_upload',
    connectHelp: 'In Deputy, export your timesheet as CSV and drop it in.',
    blurb: 'Works with Deputy\u2019s standard timesheet CSV export.',
    importShifts: ({ csv }) => Promise.resolve(parseShiftsFromCsv(csv, { source: 'csv_deputy' }).shifts),
  },
  csv_homebase: {
    id: 'csv_homebase',
    name: 'Homebase (CSV)',
    kind: 'workforce',
    authType: 'csv_upload',
    connectHelp: 'In Homebase, export your timesheet as CSV and drop it in.',
    blurb: 'Works with Homebase\u2019s standard timesheet export.',
    importShifts: ({ csv }) => Promise.resolve(parseShiftsFromCsv(csv, { source: 'csv_homebase' }).shifts),
  },
  csv_7shifts: {
    id: 'csv_7shifts',
    name: '7shifts (CSV)',
    kind: 'workforce',
    authType: 'csv_upload',
    connectHelp: 'In 7shifts, export your schedule or timesheet as CSV.',
    blurb: 'Restaurant-friendly workforce management app.',
    importShifts: ({ csv }) => Promise.resolve(parseShiftsFromCsv(csv, { source: 'csv_7shifts' }).shifts),
  },
  csv_sling: {
    id: 'csv_sling',
    name: 'Sling (CSV)',
    kind: 'workforce',
    authType: 'csv_upload',
    connectHelp: 'In Sling, export the schedule or timesheet as CSV.',
    blurb: 'Hourly-staff scheduler used across restaurants and retail.',
    importShifts: ({ csv }) => Promise.resolve(parseShiftsFromCsv(csv, { source: 'csv_sling' }).shifts),
  },
  csv_generic: {
    id: 'csv_generic',
    name: 'Generic CSV',
    kind: 'workforce',
    authType: 'csv_upload',
    connectHelp: 'Any CSV with date, start, and end columns. Optional: break, tips, employer.',
    blurb: 'Catch-all for tools that export timesheets to CSV.',
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
