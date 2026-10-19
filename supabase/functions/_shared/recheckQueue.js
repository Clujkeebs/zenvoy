/* ── recheckQueue.js — which saved prospects are due a measurement ────────
 *
 * The scheduled function uses this after it reads leads. A lead is due when
 * it has a website, is not lost, and has never been watched or was last
 * watched at least 7 days ago. The batch is small so one run finishes inside
 * the edge time limit. This file does not measure anything and does not
 * spend a scan credit.
 * ─────────────────────────────────────────────────────────────────────── */

export const RECHECK_BATCH = 8
export const RECHECK_STALE_MS = 7 * 24 * 60 * 60 * 1000

function watchedAt(lead) {
  const raw = lead?.lastWatchAt || lead?.last_watch_at || ''
  const at = Date.parse(raw)
  return Number.isFinite(at) ? at : null
}

export function dueForRecheck(lead, now = Date.now()) {
  if (!lead || !String(lead.website || '').trim()) return false
  if (lead.status === 'lost') return false
  const at = watchedAt(lead)
  if (at == null) return true
  return now - at >= RECHECK_STALE_MS
}

export function pickRecheckBatch(leads = [], now = Date.now(), limit = RECHECK_BATCH) {
  return leads
    .filter(lead => dueForRecheck(lead, now))
    .sort((a, b) => (watchedAt(a) ?? 0) - (watchedAt(b) ?? 0))
    .slice(0, limit)
}
