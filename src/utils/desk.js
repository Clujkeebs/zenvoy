/* ── desk.js — what is worth opening the app for today ──────────────────
 *
 * Combines three things a chatbot does not have: the watch log (what changed
 * on sites you already measured), the follow-up dates you set, and the
 * strongest leads you have not contacted yet.
 * ─────────────────────────────────────────────────────────────────────── */

import { buildWorkQueue } from './workqueue'
import { unseenChanges, watchableLeads } from './watch'

/**
 * The strongest leads that have never been contacted.
 * Ranked by measured score, then by how many verified findings they have.
 */
export function bestNewLeads(leads = [], limit = 5) {
  return leads
    .filter(l => l && (l.status === 'new' || !l.status))
    .slice()
    .sort((a, b) =>
      (b.score || 0) - (a.score || 0)
      || (b.findings?.length || 0) - (a.findings?.length || 0),
    )
    .slice(0, limit)
}

/**
 * One snapshot for the Today screen.
 */
export function buildDesk(leads = [], opts = {}) {
  const queue = buildWorkQueue(leads, opts)
  const changes = unseenChanges(leads, opts.now)
  const fresh = bestNewLeads(leads, opts.bestLimit ?? 5)
  const watching = watchableLeads(leads)

  return {
    changes,
    changeCount: changes.reduce((n, c) => n + c.changes.length, 0),
    queue,
    fresh,
    watching: watching.length,
    // Due follow-ups are the only items with a date the user chose.
    due: queue.groups.find(g => g.id === 'followups')?.count || 0,
  }
}
