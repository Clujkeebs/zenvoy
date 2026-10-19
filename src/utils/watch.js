/* ── watch.js — what changed since the last measurement ──────────────────
 *
 * A chat window can describe a website once. It cannot tell you, two weeks
 * later, that the same café added online booking or that the site stopped
 * loading. That requires storing a measurement and comparing the next one.
 *
 * Every change below cites both observations. Nothing here is inferred.
 * ─────────────────────────────────────────────────────────────────────── */

import { deriveFindings, scoreFindings } from './evidence.js'

const SPEED_RATIO = 1.4
const SPEED_DELTA_MS = 400

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return 'the site' }
}

/**
 * Compare two site measurements.
 *
 * @param {object|null} prev
 * @param {object|null} next
 * @returns {Array<{key:string, direction:'fixed'|'broke'|'changed', label:string, detail:string}>}
 */
export function diffMeasurements(prev, next) {
  if (!prev || !next) return []
  const changes = []
  const host = hostOf(next.finalUrl || next.url || prev.url)

  const add = (key, direction, label, detail) =>
    changes.push({ key, direction, label, detail })

  if (prev.reachable === true && next.reachable === false) {
    add('reachable', 'broke', 'Website stopped loading',
      `${host} loaded last time and did not this time${next.error ? `: ${next.error}` : ''}.`)
    // Further fields are meaningless if the page never came back.
    return changes
  }

  if (prev.reachable === false && next.reachable === true) {
    add('reachable', 'fixed', 'Website is loading again',
      `${host} failed last time${prev.error ? ` (${prev.error})` : ''} and returned status ${next.status ?? '200'} this time.`)
  }

  if (prev.https === false && next.https === true) {
    add('https', 'fixed', 'HTTPS added',
      `${host} was served over plain http and now loads over https.`)
  } else if (prev.https === true && next.https === false) {
    add('https', 'broke', 'HTTPS lost',
      `${host} was on https and is now served over plain http.`)
  }

  flagBool(add, prev, next, 'hasViewport', 'mobile',
    'Mobile layout added', 'The homepage had no viewport tag and now has one.',
    'Mobile layout removed', 'The homepage had a viewport tag and no longer does.')

  flagBool(add, prev, next, 'hasBookingLink', 'booking',
    'Online booking added', bookingDetail(next),
    'Online booking removed', 'A booking link was on the homepage last time and is not there now.')

  flagBool(add, prev, next, 'hasPhoneLink', 'phone',
    'Tap-to-call added', 'A clickable phone link is on the homepage now. It was not last time.',
    'Tap-to-call removed', 'The clickable phone link that was on the homepage is gone.')

  flagBool(add, prev, next, 'hasContactForm', 'contact',
    'Contact form added', 'A contact form is on the homepage now. It was not last time.',
    'Contact form removed', 'The contact form that was on the homepage is gone.')

  flagBool(add, prev, next, 'hasAnalytics', 'analytics',
    'Analytics installed', 'Analytics or a pixel is present now. None was detected last time.',
    'Analytics removed', 'Analytics that was detected last time is no longer on the page.')

  flagBool(add, prev, next, 'hasMetaDescription', 'meta',
    'Search description added', 'The homepage now has a meta description. It did not last time.',
    'Search description removed', 'The meta description that was on the homepage is gone.')

  flagBool(add, prev, next, 'hasStructuredData', 'schema',
    'Structured data added', 'The page now publishes structured data. It did not last time.',
    'Structured data removed', 'Structured data that was on the page last time is gone.')

  if (prev.looksParked === true && next.looksParked === false && next.reachable) {
    add('parked', 'fixed', 'No longer a placeholder',
      `${host} looked parked or "coming soon" last time and now serves a real page.`)
  } else if (prev.looksParked === false && next.looksParked === true) {
    add('parked', 'broke', 'Domain looks parked',
      `${host} served a real page last time and now looks parked or "coming soon".`)
  }

  if (typeof prev.title === 'string' && typeof next.title === 'string'
      && prev.title.trim() && next.title.trim() && prev.title.trim() !== next.title.trim()) {
    add('title', 'changed', 'Page title changed',
      `Title was "${trimTitle(prev.title)}" and is now "${trimTitle(next.title)}".`)
  }

  if (typeof prev.copyrightYear === 'number' && typeof next.copyrightYear === 'number'
      && prev.copyrightYear !== next.copyrightYear) {
    add('copyright', 'changed', 'Footer year changed',
      `The copyright year went from ${prev.copyrightYear} to ${next.copyrightYear}.`)
  }

  if (typeof prev.responseMs === 'number' && typeof next.responseMs === 'number') {
    const delta = next.responseMs - prev.responseMs
    const ratio = next.responseMs / Math.max(prev.responseMs, 1)
    if (delta >= SPEED_DELTA_MS && ratio >= SPEED_RATIO) {
      add('speed', 'broke', 'Homepage got slower',
        `Response time went from ${secs(prev.responseMs)}s to ${secs(next.responseMs)}s.`)
    } else if (-delta >= SPEED_DELTA_MS && prev.responseMs / Math.max(next.responseMs, 1) >= SPEED_RATIO) {
      add('speed', 'fixed', 'Homepage got faster',
        `Response time went from ${secs(prev.responseMs)}s to ${secs(next.responseMs)}s.`)
    }
  }

  const prevSocial = new Set(prev.socialLinks || [])
  const nextSocial = new Set(next.socialLinks || [])
  const added = [...nextSocial].filter(s => !prevSocial.has(s))
  const removed = [...prevSocial].filter(s => !nextSocial.has(s))
  if (added.length || removed.length) {
    const bits = []
    if (added.length) bits.push(`added ${added.join(', ')}`)
    if (removed.length) bits.push(`removed ${removed.join(', ')}`)
    add('social', 'changed', 'Social links changed',
      `Homepage social links ${bits.join('; ')}.`)
  }

  return changes
}

function flagBool(add, prev, next, field, key, fixedLabel, fixedDetail, brokeLabel, brokeDetail) {
  if (prev[field] === false && next[field] === true) add(key, 'fixed', fixedLabel, fixedDetail)
  else if (prev[field] === true && next[field] === false) add(key, 'broke', brokeLabel, brokeDetail)
}

function bookingDetail(next) {
  return next.bookingProvider
    ? `A booking link (${next.bookingProvider}) is on the homepage now. None was found last time.`
    : 'A booking link is on the homepage now. None was found last time.'
}

function trimTitle(t) {
  const s = String(t).replace(/\s+/g, ' ').trim()
  return s.length > 80 ? s.slice(0, 77) + '…' : s
}

function secs(ms) {
  return (Math.round(ms / 100) / 10).toFixed(1)
}

/**
 * Fold a fresh measurement into a lead: rescore it, and append a watch entry
 * when something actually changed.
 */
export function applyRescan(lead, measurement, now = new Date().toISOString()) {
  const prev = lead?.siteMeasurement || null
  const changes = diffMeasurements(prev, measurement)
  const all = deriveFindings(
    { website: lead?.website, phone: lead?.phone, name: lead?.name },
    measurement,
  )
  const { score, findings } = scoreFindings(all, lead?.serviceId)
  const at = measurement?.measuredAt || now
  const watchLog = Array.isArray(lead?.watchLog) ? lead.watchLog.slice() : []
  if (changes.length) {
    watchLog.push({ at, changes })
  }

  return {
    ...lead,
    siteMeasurement: measurement,
    findings,
    score,
    auditedAt: at,
    ssl: measurement?.https ?? lead?.ssl,
    speed: typeof measurement?.responseMs === 'number' ? measurement.responseMs : lead?.speed,
    problems: findings.slice(0, 5).map(f => f.label),
    watchLog: watchLog.slice(-24),
    lastWatchAt: at,
  }
}

/** Changes the user has not marked as seen, newest first. */
export function unseenChanges(leads = [], now = Date.now()) {
  const items = []
  for (const lead of leads) {
    const seen = Date.parse(lead?.watchSeenAt || '') || 0
    const fresh = (lead?.watchLog || []).filter(entry => (Date.parse(entry?.at || '') || 0) > seen)
    if (!fresh.length) continue
    const changes = fresh.flatMap(entry => entry.changes || [])
    if (!changes.length) continue
    const at = fresh[fresh.length - 1].at
    items.push({ lead, changes, at, ageMs: (Date.parse(at) || now) })
  }
  items.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0))
  return items
}

/** Saved prospects that have a website and can be re-measured. */
export function watchableLeads(leads = []) {
  return leads.filter(l => l && l.website && l.status !== 'lost')
}
