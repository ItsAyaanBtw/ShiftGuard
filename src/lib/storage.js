const KEYS = {
  SHIFTS: 'shiftguard_shifts',
  PAYSTUB: 'shiftguard_paystub',
  PAYSTUB_IMAGE: 'shiftguard_paystub_image',
  VIOLATIONS: 'shiftguard_violations',
  STATE: 'shiftguard_state',
  CITY: 'shiftguard_city',
  DOCUMENTS: 'shiftguard_documents',
}

function read(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function remove(key) {
  localStorage.removeItem(key)
}

export function getShifts() {
  return read(KEYS.SHIFTS) || []
}

export function saveShifts(shifts) {
  write(KEYS.SHIFTS, shifts)
}

export function getPaystub() {
  return read(KEYS.PAYSTUB)
}

export function savePaystub(paystub) {
  write(KEYS.PAYSTUB, paystub)
}

export function getPaystubImage() {
  return read(KEYS.PAYSTUB_IMAGE)
}

export function savePaystubImage(url) {
  if (url) write(KEYS.PAYSTUB_IMAGE, url)
  else remove(KEYS.PAYSTUB_IMAGE)
}

export function getViolations() {
  return read(KEYS.VIOLATIONS)
}

export function saveViolations(violations) {
  write(KEYS.VIOLATIONS, violations)
}

export function getUserState() {
  return read(KEYS.STATE) || 'TX'
}

export function saveUserState(stateCode) {
  write(KEYS.STATE, stateCode)
}

export function getUserCity() {
  return read(KEYS.CITY)
}

export function saveUserCity(city) {
  if (city) write(KEYS.CITY, city)
  else remove(KEYS.CITY)
}

export function getDocuments() {
  return read(KEYS.DOCUMENTS)
}

export function saveDocuments(docs) {
  write(KEYS.DOCUMENTS, docs)
}

export function clearAll() {
  Object.values(KEYS).forEach(remove)
}
