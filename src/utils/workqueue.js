/* ── workqueue.js — what to actually do today ────────────────────────────
 *
 * A chat assistant can write you a cold email. What it can't do is remember
 * that you emailed 40 businesses, that 6 replied, that 11 have gone quiet for
 * two weeks, and that the evidence you pitched three of them on is now a month
 * stale. That memory — and turning it into a short ordered list of next actions
 * — is the part of this product that can't be replaced by a chat window.
 *
 * Pure functions over the leads array, so they're cheap to test and don't care
 * where the data came from.
 * ─────────────────────────────────────────────────────────────────────── */

import { toMs, leadTime } from './helpers'

const DAY = 86_400_000

/** Statuses that mean the deal is finished, one way or another. */
export const CLOSED = new Set(['won', 'lost'])

/** Statuses that mean you've made contact and are waiting on them. */
export const IN_FLIGHT = new Set(['contacted', 'interested', 'proposal sent', 'negotiating'])

export const DEFAULTS = {
  staleAfterDays: 7,      // contacted this long ago with no movement → chase
  reverifyAfterDays: 30,  // evidence older than this may no longer be true
  maxPerGroup: 5,
}

/**
 * Build today's action list.
 *
 * @param {Array}  leads
 * @param {Object} opts   — { now, staleAfterDays, reverifyAfterDays, maxPerGroup }
 * @returns {{groups: Array, total: number}}
 */
export function buildWorkQueue(leads = [], opts = {}) {
  const { now = Date.now(), staleAfterDays, reverifyAfterDays, maxPerGroup } = {
    ...DEFAULTS, ...opts,
  }

  const open = leads.filter(l => !CLOSED.has(l.status))
  const today = new Date(now).toISOString().slice(0, 10)

  // 1. Follow-ups you scheduled and that are now due.
  const dueFollowUps = open
    .filter(l => l.followUpDate && String(l.followUpDate).slice(0, 10) <= today)
    .sort((a, b) => String(a.followUpDate).localeCompare(String(b.followUpDate)))

  // 2. Never contacted, strongest evidence first — the best use of an hour.
  const scheduled = new Set(dueFollowUps.map(l => l.id))
  const untouched = open
    .filter(l => l.status === 'new' && !scheduled.has(l.id))
    .sort((a, b) => (b.score || 0) - (a.score || 0) || leadTime(b) - leadTime(a))

  // 3. Contacted, then silence. Nobody's job to remember these but yours.
  const goneQuiet = open
    .filter(l => {
      if (!IN_FLIGHT.has(l.status)) return false
      if (l.followUpDate) return false // already has a plan
      const since = toMs(l.contactedAt) ?? leadTime(l)
      return since > 0 && now - since > staleAfterDays * DAY
    })
    .sort((a, b) => {
      const aT = toMs(a.contactedAt) ?? leadTime(a)
      const bT = toMs(b.contactedAt) ?? leadTime(b)
      return aT - bT // longest silence first
    })

  // 4. Evidence going stale. Pitching a fixed problem is worse than not
  //    pitching at all, so this protects your credibility.
  const needsReverify = open
    .filter(l => {
      if (!l.website || !l.auditedAt) return false
      if (!(l.findings || []).length) return false
      const age = now - (toMs(l.auditedAt) ?? now)
      return age > reverifyAfterDays * DAY
    })
    .sort((a, b) => (toMs(a.auditedAt) ?? 0) - (toMs(b.auditedAt) ?? 0))

  const groups = [
    {
      id: 'followups',
      label: 'Follow-ups due',
      tone: 'amber',
      hint: 'You set a date and it has arrived.',
      leads: dueFollowUps.slice(0, maxPerGroup),
      count: dueFollowUps.length,
    },
    {
      id: 'untouched',
      label: 'Best leads not yet contacted',
      tone: 'lime',
      hint: 'Ranked by verified issues — start at the top.',
      leads: untouched.slice(0, maxPerGroup),
      count: untouched.length,
    },
    {
      id: 'quiet',
      label: `No reply in ${staleAfterDays}+ days`,
      tone: 'blue',
      hint: 'Most deals die here, from silence rather than a no.',
      leads: goneQuiet.slice(0, maxPerGroup),
      count: goneQuiet.length,
    },
    {
      id: 'reverify',
      label: 'Evidence needs re-checking',
      tone: 'purple',
      hint: `Measured over ${reverifyAfterDays} days ago — they may have fixed it.`,
      leads: needsReverify.slice(0, maxPerGroup),
      count: needsReverify.length,
    },
  ].filter(g => g.count > 0)

  return { groups, total: groups.reduce((n, g) => n + g.count, 0) }
}

/**
 * What's actually working for this user.
 *
 * Once there are enough closed deals to mean anything, this says which
 * evidence types precede a win. That's a feedback loop no chat assistant has,
 * because it requires remembering your outcomes.
 *
 * @returns {{ready:boolean, sample:number, rows:Array}}
 */
export function conversionByFinding(leads = [], minSample = 8) {
  const closed = leads.filter(l => CLOSED.has(l.status))
  if (closed.length < minSample) {
    return { ready: false, sample: closed.length, needed: minSample, rows: [] }
  }

  const tally = new Map()
  for (const lead of closed) {
    const won = lead.status === 'won'
    // Count each finding type once per lead.
    const ids = new Set((lead.findings || []).map(f => f.id))
    for (const id of ids) {
      const label = (lead.findings || []).find(f => f.id === id)?.label || id
      const row = tally.get(id) || { id, label, won: 0, total: 0 }
      row.total += 1
      if (won) row.won += 1
      tally.set(id, row)
    }
  }

  const rows = [...tally.values()]
    .filter(r => r.total >= 3) // don't draw conclusions from one deal
    .map(r => ({ ...r, rate: r.won / r.total }))
    .sort((a, b) => b.rate - a.rate || b.total - a.total)

  return { ready: rows.length > 0, sample: closed.length, rows }
}

/** Headline pipeline numbers, computed once. */
export function pipelineStats(leads = []) {
  const won = leads.filter(l => l.status === 'won')
  const inFlight = leads.filter(l => IN_FLIGHT.has(l.status))
  const rate = value => value.reduce(
    (n, l) => n + (l.wonValue || l.myMonthlyRate || l.suggestedMonthlyRate || 0), 0,
  )
  const contacted = leads.filter(l => l.status !== 'new').length

  return {
    total: leads.length,
    contacted,
    inFlight: inFlight.length,
    won: won.length,
    lost: leads.filter(l => l.status === 'lost').length,
    pipelineValue: rate(inFlight),
    wonValue: rate(won),
    // Of the ones you actually contacted, how many closed?
    winRate: contacted > 0 ? won.length / contacted : 0,
  }
}
