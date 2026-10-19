/* ── deskAgent.js — tool-calling kernel for Ask your desk ─────────────────
 *
 * The edge function runs this against the signed-in user's rows. Vitest runs
 * the same file with fixture leads. Nothing here sends email, and nothing
 * here writes. Tools that would change a lead return a proposal the user
 * confirms in the browser.
 *
 * planAllowsDeskAgent is the gate the desk_agent task uses. It matches
 * planAllowsAI in http.ts (pro / scale / enterprise, owner, active trial).
 * ─────────────────────────────────────────────────────────────────────── */

import { STATUSES } from '../../../src/constants/services.js'
import { draftFollowUp } from '../../../src/utils/agent.js'
import { compareToPeers } from '../../../src/utils/benchmark.js'

const AI_PLANS = new Set(['pro', 'scale', 'enterprise'])

export const DESK_LIMITS = { perMinute: 8, perDay: 80 }

export const DESK_SYSTEM = [
  'You are the Zenvylo desk for one signed-in user.',
  'You have no lead list in this prompt. Call a tool to read their saved leads, checks, watch log, neighbour comparisons, or pipeline.',
  'Every sentence that states a fact about a lead, a site, a number, or a change must end with a citation token copied from a tool result, written exactly as [[cite:ID]].',
  'If a tool says the measurement is not stored, say that and cite it. Do not guess, and do not invent a business, a price, a rating, or a percentage.',
  'You cannot send email. There is no send tool. If asked to send, refuse.',
  'propose_recheck and propose_move_stage only propose. Tell the user to confirm. Do not say the change already happened.',
  'draft_follow_up returns the note to show. Do not claim it was sent.',
  'plan_prospect plans a scan. It does not measure anyone.',
  'If the question is not about this desk, say you can only answer from saved leads and their checks.',
].join(' ')

const PLAN_CONSTRAINTS = {
  no_booking: 'No online booking',
  no_https: 'No HTTPS',
  unreachable: 'Website does not load',
  no_website: 'No website listed',
  slow: 'Slow to respond',
  no_contact: 'No way to make contact online',
  no_phone: 'No tap-to-call or listed phone',
}

const SEND_TOOL = /send|email|mail|dispatch/i

export function planAllowsDeskAgent(profile) {
  if (!profile) return false
  if (profile.role === 'owner') return true
  if (AI_PLANS.has(profile.plan)) return true
  if (profile.trial_end && new Date(profile.trial_end).getTime() > Date.now()) return true
  return false
}

export function wantsSend(text) {
  const raw = String(text || '')
  if (!/\b(send|email them|mail this|dispatch)\b/i.test(raw)) return false
  if (/\b(do not|don't|never|without)\s+send/i.test(raw)) return false
  return true
}

function strProp(description, maxLength = 200) {
  return { type: 'string', description, maxLength }
}

export const DESK_TOOLS = [
  {
    name: 'search_leads',
    description: 'Search and filter this user\'s saved leads. Returns stored fields only.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: strProp('Words to match against name, type, city, or finding text.'),
        status: { ...strProp('Pipeline stage.'), enum: STATUSES },
        city: strProp('City name.'),
        finding_id: strProp('Finding id such as no_booking or no_https.', 64),
      },
    },
  },
  {
    name: 'explain_lead',
    description: 'Explain one saved lead from its stored findings. Say when a finding is missing.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['lead'],
      properties: { lead: strProp('Lead id or saved name.', 120) },
    },
  },
  {
    name: 'compare_neighbours',
    description: 'Compare one lead to neighbour measurements already stored on it. Does not fetch new sites.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['lead'],
      properties: { lead: strProp('Lead id or saved name.', 120) },
    },
  },
  {
    name: 'watch_log',
    description: 'Read stored re-check changes for one lead, or the newest changes on the desk.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { lead: strProp('Optional lead id or name. Omit for the whole desk.', 120) },
    },
  },
  {
    name: 'plan_prospect',
    description: 'Plan a multi-step prospecting scan. Does not run it and does not invent businesses.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        city: strProp('City to measure.'),
        country: strProp('Country to measure.'),
        category: strProp('Business type the user asked for, such as dentists.'),
        constraint: strProp('One of no_booking, no_https, unreachable, no_website, slow, no_contact, no_phone.', 32),
        count: { type: 'integer', description: 'How many leads to keep, 1 to 25.' },
      },
    },
  },
  {
    name: 'propose_recheck',
    description: 'Propose a fresh measurement of one saved website. Does not run it.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['lead'],
      properties: { lead: strProp('Lead id or saved name.', 120) },
    },
  },
  {
    name: 'propose_move_stage',
    description: 'Propose moving one saved lead to another pipeline stage. Does not move it and does not email.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['lead', 'status'],
      properties: {
        lead: strProp('Lead id or saved name.', 120),
        status: { ...strProp('Pipeline stage.'), enum: STATUSES },
      },
    },
  },
  {
    name: 'draft_follow_up',
    description: 'Draft a follow-up that quotes stored findings. The draft is not sent.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['lead'],
      properties: { lead: strProp('Lead id or saved name.', 120) },
    },
  },
]

const TOOL_BY_NAME = new Map(DESK_TOOLS.map(tool => [tool.name, tool]))

export function validateToolInput(name, input) {
  if (SEND_TOOL.test(String(name || ''))) {
    return { ok: false, error: 'There is no send tool. Email is not sent from the desk.' }
  }
  const tool = TOOL_BY_NAME.get(name)
  if (!tool) return { ok: false, error: `Unknown tool: ${name || '(none)'}` }
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Tool input must be an object' }
  }
  const props = tool.input_schema.properties || {}
  const required = tool.input_schema.required || []
  for (const key of required) {
    if (input[key] == null || input[key] === '') return { ok: false, error: `Missing ${key}` }
  }
  for (const [key, value] of Object.entries(input)) {
    const spec = props[key]
    if (!spec) return { ok: false, error: `Unexpected field ${key}` }
    if (spec.type === 'string') {
      if (typeof value !== 'string') return { ok: false, error: `${key} must be a string` }
      if (value.length > (spec.maxLength || 200)) return { ok: false, error: `${key} is too long` }
      if (spec.enum && !spec.enum.includes(value)) return { ok: false, error: `${key} is not an allowed value` }
    } else if (spec.type === 'integer') {
      if (!Number.isInteger(value)) return { ok: false, error: `${key} must be an integer` }
    }
  }
  return { ok: true }
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function findLead(leads, ref) {
  const q = clean(ref).replace(/[?.!]+$/, '')
  if (!q) return null
  const lower = q.toLowerCase()
  return leads.find(lead => lead.id === q)
    || leads.find(lead => clean(lead.name).toLowerCase() === lower)
    || leads.find(lead => clean(lead.name).toLowerCase().includes(lower))
    || null
}

function addCite(ctx, lead, field, text) {
  const row = {
    id: 'c' + (ctx.citations.length + 1),
    leadId: lead?.id || '',
    name: lead?.name || '',
    field,
    text: clean(text).slice(0, 500),
  }
  ctx.citations.push(row)
  return row
}

function leadBlob(lead) {
  return [
    lead?.name, lead?.btype, lead?.city, lead?.website, lead?.status,
    ...(lead?.findings || []).flatMap(finding => [finding.id, finding.label, finding.evidence]),
  ].filter(Boolean).join(' ').toLowerCase()
}

function searchLeads(input, ctx) {
  const query = clean(input.query).toLowerCase()
  const tokens = query.split(/[^a-z0-9]+/).filter(token => token.length > 2)
  const rows = ctx.leads.filter(lead => {
    if (input.status && clean(lead.status).toLowerCase() !== input.status) return false
    if (input.city && !clean(lead.city).toLowerCase().includes(clean(input.city).toLowerCase())) return false
    if (input.finding_id && !(lead.findings || []).some(finding => finding.id === input.finding_id)) return false
    if (tokens.length && !tokens.some(token => leadBlob(lead).includes(token))) return false
    return true
  }).slice(0, 8)

  if (!rows.length) {
    return { ok: true, summary: 'No saved lead matches that filter.', citations: [] }
  }
  const citations = rows.map(lead => {
    const finding = (lead.findings || []).find(item => !input.finding_id || item.id === input.finding_id)
    const text = finding?.evidence
      || `${lead.name} is stored as ${lead.status || 'new'}${lead.city ? ` in ${lead.city}` : ''}, with no finding to quote.`
    return addCite(ctx, lead, finding ? 'findings.evidence' : 'status', text)
  })
  return {
    ok: true,
    summary: citations.map(cite => `${cite.name}: ${cite.text} [[cite:${cite.id}]]`).join('\n'),
    citations,
  }
}

function explainLead(input, ctx) {
  const lead = findLead(ctx.leads, input.lead)
  if (!lead) return { ok: true, summary: `No saved lead matches “${clean(input.lead)}”.`, citations: [] }
  const findings = (lead.findings || []).slice(0, 6)
  if (!findings.length) {
    const cite = addCite(ctx, lead, 'findings', `No measured finding is stored for ${lead.name}.`)
    return { ok: true, summary: `${cite.text} [[cite:${cite.id}]]`, citations: [cite] }
  }
  const citations = findings.map(finding => addCite(ctx, lead, 'findings.evidence', finding.evidence))
  return {
    ok: true,
    summary: citations.map(cite => `${cite.text} [[cite:${cite.id}]]`).join('\n'),
    citations,
  }
}

function compareNeighbours(input, ctx) {
  const lead = findLead(ctx.leads, input.lead)
  if (!lead) return { ok: true, summary: `No saved lead matches “${clean(input.lead)}”.`, citations: [] }
  const comparison = compareToPeers(lead.siteMeasurement, lead.benchmark)
  if (!comparison.ready) {
    const cite = addCite(ctx, lead, 'benchmark', `No neighbour measurement is stored for ${lead.name}.`)
    return { ok: true, summary: `${cite.text} [[cite:${cite.id}]]`, citations: [cite] }
  }
  const lines = comparison.headlines.length
    ? comparison.headlines
    : [`Compared with ${comparison.sampleSize} stored neighbour measurements within ${comparison.radiusKm} km. None of the checked gaps apply.`]
  const citations = lines.map(line => addCite(ctx, lead, 'benchmark', line))
  return {
    ok: true,
    summary: citations.map(cite => `${cite.text} [[cite:${cite.id}]]`).join('\n'),
    citations,
  }
}

function watchChanges(lead) {
  const events = []
  for (const entry of lead?.watchLog || []) {
    for (const change of entry?.changes || []) {
      if (!change?.detail && !change?.label) continue
      events.push({ at: entry.at, text: `${change.label}. ${change.detail}`.replace(/\s+/g, ' ').trim() })
    }
  }
  return events
}

function watchLog(input, ctx) {
  const leads = input.lead ? [findLead(ctx.leads, input.lead)].filter(Boolean) : ctx.leads
  if (input.lead && !leads.length) {
    return { ok: true, summary: `No saved lead matches “${clean(input.lead)}”.`, citations: [] }
  }
  const events = []
  for (const lead of leads) {
    for (const event of watchChanges(lead)) events.push({ lead, ...event })
  }
  events.sort((a, b) => Date.parse(b.at || '') - Date.parse(a.at || ''))
  const top = events.slice(0, 8)
  if (!top.length) {
    const who = leads.length === 1 ? leads[0] : null
    const text = who
      ? `No measured change is stored for ${who.name}.`
      : 'No measured change is stored on this desk.'
    const cite = addCite(ctx, who, 'watchLog', text)
    return { ok: true, summary: `${cite.text} [[cite:${cite.id}]]`, citations: [cite] }
  }
  const citations = top.map(event => addCite(ctx, event.lead, 'watchLog', event.text))
  return {
    ok: true,
    summary: citations.map(cite => `${cite.name}: ${cite.text} [[cite:${cite.id}]]`).join('\n'),
    citations,
  }
}

function planProspect(input, ctx) {
  const count = Math.max(1, Math.min(Number.isInteger(input.count) ? input.count : 5, 25))
  const city = clean(input.city)
  const country = clean(input.country)
  const category = clean(input.category)
  const constraint = input.constraint ? PLAN_CONSTRAINTS[input.constraint] : ''
  const steps = []
  steps.push(city && country
    ? `Look in ${city}, ${country}.`
    : 'Name a city and a country before running this. I will not pick a place.')
  steps.push(category
    ? `Keep businesses whose name or map type matches ${category}. The map search itself is not limited to that type until the results are filtered.`
    : 'No business type named, so any measured business in that place can match.')
  steps.push(constraint
    ? `After the site check, keep only those with this measured finding: ${constraint}.`
    : input.constraint
      ? `“${clean(input.constraint)}” is not a filter the desk can check, so it will not be applied.`
      : 'No extra filter. The scan ranks by the measured score for your service.')
  steps.push(`Run it from the goal box. It uses 1 scan and returns up to ${count} lead${count === 1 ? '' : 's'}.`)
  steps.push('Nothing is measured until you run it, and nothing is emailed.')
  const message = steps.join(' ')
  const action = {
    type: 'plan',
    needsConfirm: false,
    message,
    goal: { city, country, category, constraint: input.constraint || '', count },
  }
  ctx.actions.push(action)
  return { ok: true, summary: message, citations: [], action }
}

function proposeRecheck(input, ctx) {
  const lead = findLead(ctx.leads, input.lead)
  if (!lead) return { ok: true, summary: `No saved lead matches “${clean(input.lead)}”.`, citations: [] }
  if (!lead.website) {
    const cite = addCite(ctx, lead, 'website', `${lead.name} has no website stored, so there is nothing to measure.`)
    return { ok: true, summary: `${cite.text} [[cite:${cite.id}]]`, citations: [cite] }
  }
  const cite = addCite(ctx, lead, 'website', `The stored website for ${lead.name} is ${lead.website}.`)
  const action = {
    type: 'recheck',
    needsConfirm: true,
    leadId: lead.id,
    name: lead.name,
    message: `Re-check ${lead.name} (${lead.website})? This uses the measurement server, not a scan credit. Nothing is emailed.`,
  }
  ctx.actions.push(action)
  return { ok: true, summary: `${cite.text} [[cite:${cite.id}]] Confirm before measuring again.`, citations: [cite], action }
}

function proposeMove(input, ctx) {
  const lead = findLead(ctx.leads, input.lead)
  if (!lead) return { ok: true, summary: `No saved lead matches “${clean(input.lead)}”.`, citations: [] }
  if (!STATUSES.includes(input.status)) {
    return { ok: false, error: `“${clean(input.status)}” is not a stage on the desk.` }
  }
  const cite = addCite(ctx, lead, 'status', `${lead.name} is stored on the pipeline as “${lead.status || 'new'}”.`)
  const action = {
    type: 'move_stage',
    needsConfirm: true,
    leadId: lead.id,
    name: lead.name,
    status: input.status,
    message: `Move ${lead.name} from “${lead.status || 'new'}” to “${input.status}”? This does not email them.`,
  }
  ctx.actions.push(action)
  return { ok: true, summary: `${cite.text} [[cite:${cite.id}]]`, citations: [cite], action }
}

function draftLead(input, ctx) {
  const lead = findLead(ctx.leads, input.lead)
  if (!lead) return { ok: true, summary: `No saved lead matches “${clean(input.lead)}”.`, citations: [] }
  const letter = draftFollowUp(lead)
  const findings = (lead.findings || []).slice(0, 3)
  const citations = findings.length
    ? findings.map(finding => addCite(ctx, lead, 'findings.evidence', finding.evidence))
    : [addCite(ctx, lead, 'findings', letter.body)]
  const action = {
    type: 'draft',
    needsConfirm: false,
    leadId: lead.id,
    name: lead.name,
    draft: letter,
    message: letter.ok
      ? `Draft for ${lead.name}. It quotes measured findings and has not been sent.`
      : letter.body,
  }
  ctx.actions.push(action)
  return {
    ok: true,
    summary: citations.map(cite => `${cite.text} [[cite:${cite.id}]]`).join('\n'),
    citations,
    action,
  }
}

export function executeTool(name, input, ctx) {
  const check = validateToolInput(name, input || {})
  if (!check.ok) return { ok: false, error: check.error, citations: [] }
  if (name === 'search_leads') return searchLeads(input, ctx)
  if (name === 'explain_lead') return explainLead(input, ctx)
  if (name === 'compare_neighbours') return compareNeighbours(input, ctx)
  if (name === 'watch_log') return watchLog(input, ctx)
  if (name === 'plan_prospect') return planProspect(input, ctx)
  if (name === 'propose_recheck') return proposeRecheck(input, ctx)
  if (name === 'propose_move_stage') return proposeMove(input, ctx)
  if (name === 'draft_follow_up') return draftLead(input, ctx)
  return { ok: false, error: `Unknown tool: ${name}`, citations: [] }
}

function citePattern() {
  return /\[\[cite:([a-zA-Z0-9_-]+)\]\]/g
}
const FACT_RE = /\b(https?|booking|viewport|measured|measurement|finding|watch|re-?check|stage|neighbours?|neighbors?|loaded|website|phone|ssl|analytics|title)\b/i

function isFactual(sentence, names) {
  const lower = sentence.toLowerCase()
  if (names.some(name => name && lower.includes(name.toLowerCase()))) return true
  if (/\d/.test(sentence)) return true
  return FACT_RE.test(sentence)
}

function numbersAreCited(sentence, citations) {
  const ids = [...sentence.matchAll(citePattern())].map(match => match[1])
  const texts = citations.filter(cite => ids.includes(cite.id)).map(cite => cite.text).join(' ')
  const nums = sentence.replace(citePattern(), '').match(/\d+(?:\.\d+)?/g) || []
  return nums.every(num => texts.includes(num))
}

export function enforceCitations(text, citations = [], leadNames = []) {
  const allowed = new Set(citations.map(cite => cite.id))
  const names = [...new Set([
    ...leadNames.map(name => clean(name)).filter(Boolean),
    ...citations.map(cite => clean(cite.name)).filter(Boolean),
  ])]
  const cleaned = String(text || '').replace(citePattern(), (token, id) => (allowed.has(id) ? token : ''))
  const parts = cleaned.split(/(?<=[.!?])\s+|\n+/).map(part => part.trim()).filter(Boolean)
  const kept = []
  for (const sentence of parts) {
    const hasCite = citePattern().test(sentence)
    if (isFactual(sentence, names) && !hasCite) continue
    if (hasCite && !numbersAreCited(sentence, citations)) continue
    kept.push(sentence)
  }
  const out = kept.join('\n').replace(/[ \t]{2,}/g, ' ').trim()
  if (out) return out
  if (citations.length) {
    return citations.map(cite => `${cite.name ? cite.name + ': ' : ''}${cite.text} [[cite:${cite.id}]]`).join('\n')
  }
  return 'Nothing on this desk matches that. I only use saved leads, their checks, and their watch log.'
}

const NOTHING = 'Nothing on this desk matches that. I only use saved leads, their checks, and their watch log.'

export function finishDeskTurn({ message, modelText, citations = [], actions = [], sawSendTool = false, leadNames = [] }) {
  if (wantsSend(message) || sawSendTool) {
    return {
      text: 'I will not send email. Ask me to draft it, then copy it yourself.',
      citations: [],
      actions: [],
      refusedSend: true,
      source: 'policy',
    }
  }
  const plan = actions.find(action => action.type === 'plan')
  if (plan) {
    return { text: plan.message, citations: [], actions, refusedSend: false, source: 'plan' }
  }
  if (!citations.length) {
    const question = clean(modelText)
    const text = question.includes('?') && question.length < 220 && !isFactual(question, leadNames)
      ? question
      : NOTHING
    return { text, citations: [], actions, refusedSend: false, source: 'records' }
  }
  return {
    text: enforceCitations(modelText, citations, leadNames),
    citations,
    actions,
    refusedSend: false,
    source: 'model',
  }
}

export function buildDeskUserMessage(message, history = []) {
  const lines = []
  for (const turn of (history || []).slice(-6)) {
    const role = turn?.role === 'you' || turn?.role === 'user' ? 'User' : 'Desk'
    const text = clean(turn?.text).slice(0, 800)
    if (text) lines.push(`${role}: ${text}`)
  }
  lines.push(`User: ${clean(message).slice(0, 2000)}`)
  lines.push('Use tools. Cite with [[cite:ID]] copied from a tool result.')
  return lines.join('\n')
}
