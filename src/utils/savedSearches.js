/* ── savedSearches.js — a search you can run again ───────────────────────
 *
 * Kept in the browser so it works before the saved_searches table is applied.
 * Running one still spends a scan. This module only remembers the place.
 * ─────────────────────────────────────────────────────────────────────── */

const KEY = 'zv_saved_searches'
const MAX = 12

export function loadSavedSearches() {
  try {
    const rows = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(rows) ? rows.slice(0, MAX) : []
  } catch {
    return []
  }
}

export function rememberSearch(entry) {
  const row = {
    id: entry.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    label: String(entry.label || '').slice(0, 80),
    country: entry.country || '',
    city: entry.city || '',
    serviceId: entry.serviceId || '',
    serviceCustom: entry.serviceCustom || '',
    leadCount: entry.leadCount || null,
    savedAt: entry.savedAt || new Date().toISOString(),
  }
  if (!row.country || !row.label) return loadSavedSearches()
  const next = [row, ...loadSavedSearches().filter(item => item.label !== row.label || item.serviceId !== row.serviceId)]
  const trimmed = next.slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(trimmed))
  return trimmed
}

export function forgetSearch(id) {
  const next = loadSavedSearches().filter(item => item.id !== id)
  localStorage.setItem(KEY, JSON.stringify(next))
  return next
}
