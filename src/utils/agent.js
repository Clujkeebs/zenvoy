/* ── agent.js — the desk acts on stored measurements ─────────────────────
 *
 * A chatbot can invent a list of dentists. This module cannot. It plans a
 * scan, keeps only businesses whose measured findings match the goal, answers
 * questions from the leads already on the desk, and drafts follow-ups that
 * quote those findings. It never sends email. The user copies or approves.
 * ─────────────────────────────────────────────────────────────────────── */

import { COUNTRIES, STATUSES } from '../constants/services'
import { canAI, getLeadCap, getTotalScansLeft } from '../constants/plans'

const DAY = 86_400_000

export const CONSTRAINTS = {
  no_booking: {
    id: 'no_booking',
    label: 'No online booking',
    findingIds: ['no_booking'],
    needsMeasurement: true,
  },
  no_https: {
    id: 'no_https',
    label: 'No HTTPS',
    findingIds: ['no_https'],
    needsMeasurement: true,
  },
  unreachable: {
    id: 'unreachable',
    label: 'Website does not load',
    findingIds: ['site_unreachable'],
    needsMeasurement: true,
  },
  no_website: {
    id: 'no_website',
    label: 'No website listed',
    findingIds: ['no_website'],
    needsMeasurement: false,
  },
  slow: {
    id: 'slow',
    label: 'Slow to respond',
    findingIds: ['slow', 'very_slow'],
    needsMeasurement: true,
  },
  no_contact: {
    id: 'no_contact',
    label: 'No way to make contact online',
    findingIds: ['no_contact_route'],
    needsMeasurement: true,
  },
  no_phone: {
    id: 'no_phone',
    label: 'No tap-to-call or listed phone',
    findingIds: ['no_phone_link', 'no_listed_phone'],
    needsMeasurement: false,
  },
}

/** Words we can match against a business name, type, or OSM tag. */
export const CATEGORIES = [
  { id: 'dentist', label: 'dentists', words: ['dentist', 'dentists', 'dental'], btypes: ['Dental Practice'], osm: ['dentist'] },
  { id: 'doctor', label: 'clinics', words: ['doctor', 'doctors', 'clinic', 'clinics'], btypes: ['Medical Clinic', 'Medical Practice'], osm: ['doctors', 'clinic', 'physician'] },
  { id: 'plumber', label: 'plumbers', words: ['plumber', 'plumbers', 'plumbing'], btypes: ['Plumbing Company'], osm: ['plumber'] },
  { id: 'electrician', label: 'electricians', words: ['electrician', 'electricians'], btypes: ['Electrical Contractor'], osm: ['electrician'] },
  { id: 'cafe', label: 'cafés', words: ['cafe', 'cafes', 'café', 'cafés', 'coffee'], btypes: ['Café'], osm: ['cafe'] },
  { id: 'restaurant', label: 'restaurants', words: ['restaurant', 'restaurants'], btypes: ['Restaurant'], osm: ['restaurant'] },
  { id: 'salon', label: 'salons', words: ['salon', 'salons', 'hairdresser', 'barber'], btypes: ['Hair Salon', 'Beauty Salon'], osm: ['hairdresser', 'beauty'] },
  { id: 'gym', label: 'gyms', words: ['gym', 'gyms', 'fitness'], btypes: ['Fitness Gym'], osm: ['gym'] },
  { id: 'lawyer', label: 'law offices', words: ['lawyer', 'lawyers', 'attorney', 'attorneys'], btypes: ['Law Office'], osm: ['lawyer'] },
  { id: 'realtor', label: 'estate agents', words: ['realtor', 'realtors', 'estate agent'], btypes: ['Real Estate Agency'], osm: ['estate_agent', 'real_estate'] },
  { id: 'baker', label: 'bakeries', words: ['baker', 'bakers', 'bakery', 'bakeries'], btypes: ['Bakery'], osm: ['bakery'] },
]

/**
 * City names we will suggest a country for. This is a hint the user confirms.
 * It is not a measurement of a business.
 */
const CITY_COUNTRY = {
  austin: 'United States',
  houston: 'United States',
  dallas: 'United States',
  chicago: 'United States',
  seattle: 'United States',
  denver: 'United States',
  miami: 'United States',
  boston: 'United States',
  atlanta: 'United States',
  phoenix: 'United States',
  'los angeles': 'United States',
  'san francisco': 'United States',
  'new york': 'United States',
  london: 'United Kingdom',
  manchester: 'United Kingdom',
  birmingham: 'United Kingdom',
  edinburgh: 'United Kingdom',
  glasgow: 'United Kingdom',
  whitby: 'United Kingdom',
  toronto: 'Canada',
  vancouver: 'Canada',
  sydney: 'Australia',
  melbourne: 'Australia',
  dublin: 'Ireland',
  berlin: 'Germany',
  paris: 'France',
  amsterdam: 'Netherlands',
}

const US_STATE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY)\b/

const CONSTRAINT_PATTERNS = [
  [/no online booking|without (?:online )?booking|no booking|missing booking/, 'no_booking'],
  [/no https|without https|not secure|no ssl|missing ssl/, 'no_https'],
  [/does(?:n'?t| not) load|site(?: is)? down|unreachable|won'?t load/, 'unreachable'],
  [/no website|without a website|missing website/, 'no_website'],
  [/slow (?:site|website|page)|takes too long/, 'slow'],
  [/no contact form|no way to (?:contact|get in touch)|no email link/, 'no_contact'],
  [/no (?:tap-to-call|phone)|without a phone/, 'no_phone'],
]

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim()
}

export function categoryMatches(business, category) {
  if (!category) return true
  const name = clean(business?.name || business?.business?.name).toLowerCase()
  const btype = clean(business?.btype || business?.business?.btype).toLowerCase()
  const osm = clean(business?.osmTagValue || business?.business?.osmTagValue).toLowerCase()
  const words = category.words || []
  const btypes = (category.btypes || []).map(b => b.toLowerCase())
  const osmVals = (category.osm || []).map(v => v.toLowerCase())
  if (osm && osmVals.includes(osm)) return true
  if (btype && btypes.includes(btype)) return true
  return words.some(w => name.includes(w) || btype.includes(w))
}

export function constraintMatches(findings, constraint) {
  if (!constraint) return true
  const ids = new Set((findings || []).map(f => f.id))
  return constraint.findingIds.some(id => ids.has(id))
}

function findCategory(text) {
  const lower = text.toLowerCase()
  const known = CATEGORIES.find(c => c.words.some(w => new RegExp(`\\b${w}\\b`, 'i').test(lower)))
  if (known) return known
  const custom = lower.match(/\b(?:find|get)\s+(?:\d{1,2}\s+)?([a-z][a-z' -]{2,40}?)\s+in\b/)
  if (!custom) return null
  const label = clean(custom[1])
  if (!label || /^(me|some|local|businesses|leads)$/.test(label)) return null
  const word = label.split(' ')[0]
  return { id: 'custom', label, words: [word, label], btypes: [], osm: [] }
}

function findCity(text) {
  const m = text.match(/\bin\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?=\s+with\b|\s+without\b|\s+that\b|\s+who\b|\s+where\b|$)/i)
  if (!m) return { city: '', region: '' }
  let raw = clean(m[1]).replace(/[.,]$/, '')
  const state = raw.match(US_STATE)
  let city = raw
  if (state) city = clean(raw.slice(0, state.index).replace(/[,\s]+$/, ''))
  else if (raw.includes(',')) city = clean(raw.split(',')[0])
  return { city, region: state ? state[1] : '' }
}

function findCountry(text, city, region) {
  const hit = COUNTRIES.find(c => text.toLowerCase().includes(c.toLowerCase()))
  if (hit) return { country: hit, inferred: false }
  if (region) return { country: 'United States', inferred: true }
  const hinted = CITY_COUNTRY[city.toLowerCase()]
  if (hinted) return { country: hinted, inferred: true }
  return { country: '', inferred: false }
}

/**
 * Turn a sentence into a scan plan. Missing city or country is a blocker.
 * The country hint is labeled inferred so the UI can make the user confirm it.
 */
export function parseGoal(text, opts = {}) {
  const raw = clean(text)
  const missing = []
  if (!raw) missing.push('goal')

  const countMatch = raw.match(/\b(\d{1,2})\b/)
  let count = countMatch ? Number(countMatch[1]) : (opts.defaultCount || 5)
  count = Math.max(1, Math.min(count, opts.maxCount || 25, 25))

  let constraint = null
  const lower = raw.toLowerCase()
  for (const [re, id] of CONSTRAINT_PATTERNS) {
    if (re.test(lower)) { constraint = CONSTRAINTS[id]; break }
  }

  const category = findCategory(raw)
  const { city, region } = findCity(raw)
  const { country, inferred } = findCountry(raw, city, region)
  if (!city) missing.push('city')
  if (!country) missing.push('country')

  const goal = {
    text: raw,
    count,
    category,
    constraint,
    city,
    country,
    countryInferred: inferred,
    serviceId: opts.serviceId || 'web',
  }

  const lines = []
  lines.push(`Look in ${city || 'a city you name'}${country ? `, ${country}` : ''}.`)
  if (inferred) lines.push(`${country} is a guess from the city name. Change it if that is the wrong place.`)
  if (category) lines.push(`Keep businesses whose name or map type matches ${category.label}. The map search itself is not limited to that type until we filter.`)
  else lines.push('No business type named, so any measured business in that place can match.')
  if (constraint) lines.push(`After the site check, keep only those with this measured finding: ${constraint.label}.`)
  else lines.push('No extra filter. The scan ranks by the measured score for your service.')
  lines.push(`This uses 1 scan and returns up to ${count} lead${count === 1 ? '' : 's'}. Nothing is emailed.`)

  return { ok: missing.length === 0, missing, goal, plan: lines }
}

export function businessPrefer(goal) {
  if (!goal?.category) return undefined
  return business => categoryMatches(business, goal.category)
}

export function analysedKeep(goal) {
  if (!goal?.constraint) return undefined
  // scoreFindings drops categories the service does not sell. The goal filter
  // still has to see those measurements, so it reads the full list.
  return row => constraintMatches(row?.allFindings || row?.findings, goal.constraint)
}

function asRecord(row) {
  if (row?.business) {
    return {
      ...row.business,
      findings: row.findings || [],
      siteMeasurement: row.measurement || row.siteMeasurement || null,
    }
  }
  return row
}

/**
 * Split measured leads into ones that match the goal and ones that do not.
 * A constraint that needs a fetch drops leads with no measurement, and says so.
 */
export function selectForGoal(rows = [], goal) {
  const matches = []
  const skipped = []
  for (const row of rows) {
    const lead = asRecord(row)
    if (goal?.category && !categoryMatches(lead, goal.category)) {
      skipped.push({ lead, reason: 'Name and map type do not match ' + goal.category.label + '.' })
      continue
    }
    if (goal?.constraint?.needsMeasurement && !lead.siteMeasurement && !(lead.findings || []).length) {
      skipped.push({ lead, reason: 'No website measurement, so this filter cannot be checked.' })
      continue
    }
    if (goal?.constraint && !constraintMatches(lead.findings, goal.constraint)) {
      skipped.push({ lead, reason: `No measured finding for “${goal.constraint.label}”.` })
      continue
    }
    const cite = (lead.findings || []).find(f => !goal?.constraint || goal.constraint.findingIds.includes(f.id))
      || (lead.findings || [])[0]
      || null
    matches.push({
      lead,
      citation: cite
        ? { leadId: lead.id, name: lead.name, field: 'findings.evidence', text: cite.evidence, label: cite.label }
        : { leadId: lead.id, name: lead.name, field: 'score', text: 'Ranked from the measured score. No single finding was required.', label: 'Score' },
    })
  }
  return { matches, skipped }
}

export function buildDigest(leads = [], now = Date.now()) {
  const since = now - 7 * DAY
  const events = []
  for (const lead of leads) {
    for (const entry of lead?.watchLog || []) {
      const at = Date.parse(entry?.at || '')
      if (!Number.isFinite(at) || at < since || at > now) continue
      for (const change of entry.changes || []) {
        events.push({
          leadId: lead.id,
          name: lead.name,
          at: entry.at,
          key: change.key,
          label: change.label,
          detail: change.detail,
          direction: change.direction,
        })
      }
    }
  }
  events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const summary = events.length
    ? `${events.length} measured change${events.length === 1 ? '' : 's'} in the last 7 days.`
    : 'No measured changes in the last 7 days.'
  return { since, events, summary }
}

export function nextActions(leads = [], now = Date.now()) {
  const actions = []
  const today = new Date(now).toISOString().slice(0, 10)
  const open = leads.filter(l => l && l.status !== 'won' && l.status !== 'lost')

  for (const lead of open) {
    if (lead.followUpDate && String(lead.followUpDate).slice(0, 10) <= today) {
      actions.push({
        id: 'follow-' + lead.id,
        type: 'draft',
        leadId: lead.id,
        name: lead.name,
        title: `Draft a follow-up for ${lead.name}`,
        reason: `You set a follow-up date of ${String(lead.followUpDate).slice(0, 10)}.`,
        cite: null,
      })
    }
  }

  const digest = buildDigest(open, now)
  for (const event of digest.events) {
    if (actions.length >= 6) break
    actions.push({
      id: 'watch-' + event.leadId + event.key,
      type: 'review_change',
      leadId: event.leadId,
      name: event.name,
      title: `${event.name}: ${event.label}`,
      reason: event.detail,
      cite: { field: 'watchLog', text: event.detail },
    })
  }

  const fresh = open
    .filter(l => l.status === 'new' && (l.findings || []).length)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
  for (const lead of fresh) {
    if (actions.some(a => a.leadId === lead.id)) continue
    const f = lead.findings[0]
    actions.push({
      id: 'proof-' + lead.id,
      type: 'draft',
      leadId: lead.id,
      name: lead.name,
      title: `Draft from the check on ${lead.name}`,
      reason: f.evidence,
      cite: { field: 'findings.evidence', text: f.evidence, label: f.label },
    })
    if (actions.length >= 5) break
  }

  return actions.slice(0, 5)
}

/** A follow-up that quotes findings and does not claim it was sent. */
export function draftFollowUp(lead, preparer = '') {
  const findings = (lead?.findings || []).slice(0, 3)
  if (!findings.length) {
    return {
      ok: false,
      subject: '',
      body: `${lead?.name || 'This lead'} has no measured finding yet, so there is nothing honest to put in an email.`,
    }
  }
  const when = lead?.auditedAt ? ` on ${String(lead.auditedAt).slice(0, 10)}` : ''
  const site = lead?.website ? ` (${lead.website})` : ''
  const lines = findings.map(f => `- ${f.evidence}`)
  const who = clean(preparer) || 'I'
  const subject = `${lead.name} — a check of the website`
  const body = [
    'Hi,',
    '',
    `${who === 'I' ? 'I' : who} checked the website for ${lead.name}${site}${when}. These are the things the check recorded:`,
    '',
    ...lines,
    '',
    'I can send a one-page proof of those checks. This note has not been sent.',
    '',
    who === 'I' ? '' : who,
  ].filter((line, i, arr) => !(line === '' && i === arr.length - 1)).join('\n')
  return { ok: true, subject, body }
}

function leadBlob(lead) {
  const bits = [
    lead?.name, lead?.btype, lead?.city, lead?.website, lead?.status,
    ...(lead?.findings || []).flatMap(f => [f.label, f.evidence]),
  ]
  return bits.filter(Boolean).join(' ').toLowerCase()
}

function findLead(leads, name) {
  const q = clean(name).toLowerCase().replace(/[?.!]+$/, '')
  if (!q) return null
  return leads.find(l => clean(l.name).toLowerCase() === q)
    || leads.find(l => clean(l.name).toLowerCase().includes(q))
    || null
}

/**
 * Commands the user can confirm. There is no send command.
 */
export function proposeAction(text, leads = []) {
  const raw = clean(text)
  if (!raw) return null
  if (/\b(send|email them|mail this|dispatch)\b/i.test(raw) && !/\bdraft\b/i.test(raw)) {
    return {
      type: 'refuse_send',
      message: 'I will not send email. Ask me to draft it, then copy it yourself.',
    }
  }
  const move = raw.match(/\bmove\s+(.+?)\s+to\s+([a-z ]+)\s*$/i)
  if (move) {
    const status = STATUSES.find(s => s === move[2].trim().toLowerCase())
    const lead = findLead(leads, move[1])
    if (!status) return { type: 'refuse', message: `“${move[2].trim()}” is not a stage on the desk.` }
    if (!lead) return { type: 'missing_lead', message: `No saved lead matches “${clean(move[1])}”.` }
    return {
      type: 'move_stage',
      needsConfirm: true,
      leadId: lead.id,
      name: lead.name,
      status,
      message: `Move ${lead.name} to “${status}”? This does not email them.`,
    }
  }
  const recheck = raw.match(/\bre-?check\s+(.+)$/i)
  if (recheck) {
    const lead = findLead(leads, recheck[1])
    if (!lead) return { type: 'missing_lead', message: `No saved lead matches “${clean(recheck[1])}”.` }
    if (!lead.website) return { type: 'refuse', message: `${lead.name} has no website to measure.` }
    return {
      type: 'recheck',
      needsConfirm: true,
      leadId: lead.id,
      name: lead.name,
      message: `Re-check ${lead.name} (${lead.website})? This uses the measurement server, not a scan credit.`,
    }
  }
  const draft = raw.match(/\bdraft\b.*\b(?:for|about)\s+(.+)$/i)
  if (draft) {
    const lead = findLead(leads, draft[1])
    if (!lead) return { type: 'missing_lead', message: `No saved lead matches “${clean(draft[1])}”.` }
    const letter = draftFollowUp(lead)
    return {
      type: 'draft',
      needsConfirm: false,
      leadId: lead.id,
      name: lead.name,
      draft: letter,
      message: letter.ok
        ? `Draft for ${lead.name}. It quotes measured findings and has not been sent.`
        : letter.body,
    }
  }
  return null
}

/** Answer from the desk only. If nothing stored matches, say so. */
export function answerDesk(question, leads = [], now = Date.now()) {
  const q = clean(question)
  const lower = q.toLowerCase()
  if (/what changed|this week|last 7 days|digest/.test(lower)) {
    const digest = buildDigest(leads, now)
    return {
      text: digest.summary,
      citations: digest.events.slice(0, 6).map(e => ({
        leadId: e.leadId,
        name: e.name,
        field: 'watchLog',
        text: `${e.label}. ${e.detail}`,
      })),
    }
  }
  const tokens = lower.split(/[^a-z0-9]+/).filter(t => t.length > 2 && !STOP.has(t))
  const ranked = leads.map(lead => {
    const blob = leadBlob(lead)
    const score = tokens.reduce((n, t) => n + (blob.includes(t) ? 1 : 0), 0)
    return { lead, score }
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)

  if (!ranked.length) {
    return {
      text: 'Nothing on this desk matches that. I only use saved leads, their checks, and their watch log.',
      citations: [],
    }
  }
  const citations = []
  const lines = ranked.map(({ lead }) => {
    const finding = (lead.findings || []).find(f => tokens.some(t => `${f.label} ${f.evidence}`.toLowerCase().includes(t)))
      || (lead.findings || [])[0]
    if (finding) {
      citations.push({ leadId: lead.id, name: lead.name, field: 'findings.evidence', text: finding.evidence, label: finding.label })
      return `${lead.name}: ${finding.evidence}`
    }
    return `${lead.name} is on the desk as ${lead.status || 'new'}, with no finding to quote.`
  })
  return { text: lines.join('\n'), citations }
}

const STOP = new Set(['the', 'and', 'for', 'with', 'what', 'who', 'how', 'does', 'have', 'has', 'this', 'that', 'your', 'desk', 'about', 'from', 'any', 'are', 'was'])

export function agentLimits(user) {
  const scansLeft = getTotalScansLeft(user)
  return {
    model: canAI(user),
    scansLeft,
    leadCap: getLeadCap(user),
    sample: !!user?.sample,
  }
}
