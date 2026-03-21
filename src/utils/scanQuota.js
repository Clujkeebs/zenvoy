// ─── Free Plan Scan Quota ──────────────────────────────
// Tracks monthly scan usage for free-tier users in localStorage.
// When migrating to Supabase, replace with server-side tracking.

const SCAN_LIMIT = 3
const STORAGE_KEY = "scanUsage"

export function getScanUsage() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
  const month = new Date().getMonth()
  if (data.month !== month) {
    return { month, used: 0 }
  }
  return data
}

export function incrementScanUsage() {
  const usage = getScanUsage()
  const updated = {
    month: new Date().getMonth(),
    used: usage.used + 1,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}

export function hasFreeScansLeft() {
  const usage = getScanUsage()
  return usage.used < SCAN_LIMIT
}

export function getFreeScansLeft() {
  const usage = getScanUsage()
  return Math.max(0, SCAN_LIMIT - usage.used)
}

export const FREE_SCAN_LIMIT = SCAN_LIMIT
