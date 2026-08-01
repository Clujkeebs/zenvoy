import { resolveService } from '../constants/services'
import { fetchRealBusinesses } from './places'
import { deriveFindings, scoreFindings } from './evidence'
import { compareToPeers, benchmarkEvidence } from './benchmark'
import { supabase } from '../lib/supabase'
import * as DB from './db'

/* ── AI calls go through the edge function by task name ──────────────────
 *
 * The client no longer sends prompt text. It names a task and passes typed
 * params; the prompt is built server-side. That's what stops the proxy from
 * being usable as a free general-purpose LLM on our API key, and it keeps the
 * "never state a measurement you weren't given" rule in one place.
 * ─────────────────────────────────────────────────────────────────────── */

const MAX_RETRIES = 2
const RETRY_STATUSES = new Set([429, 502, 503, 529])

const AI_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/ai-proxy'

export class UpgradeRequiredError extends Error {
  constructor(message, plan) {
    super(message)
    this.name = 'UpgradeRequiredError'
    this.requiredPlan = plan || 'pro'
  }
}

export async function aiTask(task, params = {}, attempt = 0) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Your session expired — sign in again.')

  let res
  try {
    res = await fetch(AI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify({ task, params }),
    })
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('Request cancelled.')
    throw new Error('Network error — check your internet connection.')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))

    // 402 is the server declining on plan grounds. Surface it as an upgrade
    // prompt rather than a generic failure.
    if (res.status === 402) {
      throw new UpgradeRequiredError(err?.error || 'This feature needs a paid plan.', err?.upgrade)
    }

    if (RETRY_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
      const wait = err?.retryAfter
        ? Math.min(err.retryAfter * 1000, 10_000)
        : Math.min(1500 * Math.pow(2, attempt), 8000)
      await new Promise(r => setTimeout(r, wait))
      return aiTask(task, params, attempt + 1)
    }

    throw new Error(err?.error || 'AI service error ' + res.status)
  }

  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text || ''
}

/* ── Lead generation ─────────────────────────────────────────────────────
 *
 * Pipeline:
 *   1. OpenStreetMap gives us real businesses in the target area.
 *   2. audit-site fetches each one's website and measures it.
 *   3. evidence.js turns measurements into findings and a score — in code,
 *      deterministically, with every point traceable to an observation.
 *   4. Claude writes one sentence per lead, citing those findings.
 *
 * Step 3 used to be step 4's job, which is why the old scores meant nothing.
 * ─────────────────────────────────────────────────────────────────────── */

const AUDIT_CAP = 24

/**
 * @param {Object}   opts
 * @param {string}   opts.service        — preset service id, or "" when custom
 * @param {string}   opts.customService  — free-text service, when not a preset
 * @param {Function} opts.onProgress     — (message) => void, for the scan log
 */
export async function generateLeads({
  service, customService, country, city, existingNames = [],
  lowBudget, count = 5, maxCount = 25, onProgress = () => {},
}) {
  // The caller picks the count, but a tampered client shouldn't be able to ask
  // for a thousand — every result costs a fetch and a measurement.
  count = Math.max(1, Math.min(Math.round(Number(count) || 5), maxCount, 25))
  const svc = resolveService(service, customService)
  const loc = city ? city + ', ' + country : country

  /* ── 1. Real businesses ─────────────────────────────── */
  onProgress('Locating ' + loc + ' on the map…')
  const pool = await fetchRealBusinesses({ city, country })

  const seen = new Set(existingNames.map(n => String(n).toLowerCase().trim()))
  const filtered = pool.filter(b => !seen.has(b.name.toLowerCase().trim()))
  if (filtered.length === 0) {
    throw new Error(
      `Every business we found in ${loc} is already in your leads. Try a nearby city.`,
    )
  }

  // Audit more than we need so scoring has something to choose between.
  const workSet = filtered.slice(0, Math.min(Math.max(count * 3, count + 6), AUDIT_CAP))
  onProgress(`Found ${filtered.length} businesses — checking ${workSet.length} websites…`)

  /* ── 2. Measure their websites ──────────────────────── */
  const withSites = workSet.filter(b => b.website)
  let measurements = []
  if (withSites.length) {
    measurements = await DB.auditSites(withSites.map(b => b.website))
  }
  const byUrl = new Map()
  measurements.forEach((m, i) => {
    if (m) byUrl.set(withSites[i].website, m)
  })

  const measuredCount = measurements.filter(m => m?.reachable).length
  onProgress(`Measured ${measuredCount} live site${measuredCount === 1 ? '' : 's'}…`)

  /* ── 3. Findings + score, computed here, not guessed ── */
  const analysed = workSet.map(b => {
    const measurement = b.website ? byUrl.get(b.website) || null : null
    const all = deriveFindings(b, measurement)
    const { score, findings } = scoreFindings(all, svc.id)
    return { business: b, measurement, findings, allFindings: all, score }
  })

  // Best prospects first — most verified, most relevant problems.
  analysed.sort((a, b) => b.score - a.score)
  const chosen = analysed.slice(0, count)

  onProgress('Ranking by verified issues…')

  /* ── 4. Claude writes the pitch, citing the findings ── */
  let analysis = []
  try {
    const text = await aiTask('lead_analysis', {
      service: svc.label,
      location: loc,
      country,
      lowBudget: !!lowBudget,
      businesses: chosen.map(c => ({
        name: c.business.name,
        btype: c.business.btype,
        findings: c.findings.map(f => f.evidence),
      })),
    })
    analysis = parseJsonArray(text)
  } catch (e) {
    // A failed write-up doesn't invalidate the measurements — ship the leads
    // with a plain-language fallback instead of losing the scan.
    console.warn('lead_analysis failed, using measured summary:', e.message)
    analysis = []
  }

  const nowIso = new Date().toISOString()

  return chosen.map((c, i) => {
    const a = analysis.find(x => x?.i === i) ?? analysis[i] ?? {}
    const { business: b, measurement, findings, score } = c

    const suggested = clampInt(a.suggestedMonthlyRate, 200, 25_000, defaultRate(findings.length))
    const tools = clampInt(a.toolsCostMonthly, 0, 5_000, 90)
    const setup = clampInt(a.setupCost, 0, 20_000, 250)

    return {
      id: 'l_' + Date.now() + '_' + i,

      /* ── From OpenStreetMap (real) ─────────────── */
      name: b.name,
      btype: b.btype,
      address: b.address,
      phone: b.phone ?? null,
      website: b.website ?? null,
      osmId: b.osmId ?? null,
      // Needed to find this business's nearest same-category neighbours.
      lat: b.lat ?? null,
      lon: b.lon ?? null,
      osmTagKey: b.osmTagKey ?? null,
      osmTagValue: b.osmTagValue ?? null,

      /* ── Measured (real) ───────────────────────── */
      ssl: measurement?.https ?? (b.website ? b.ssl : false),
      speed: measurement?.responseMs ?? null,
      siteMeasurement: measurement,
      findings,
      auditedAt: measurement ? measurement.measuredAt : null,
      score,

      /* ── Written by Claude, grounded in the above ─ */
      why: a.why || fallbackWhy(b, findings),
      // `problems` is the legacy column the UI and CSV already read.
      problems: findings.slice(0, 5).map(f => f.label),
      suggestedMonthlyRate: suggested,
      myMonthlyRate: suggested,
      toolsCostMonthly: tools,
      setupCost: setup,

      /* ── Deliberately not populated ─────────────
       * demandScore, competitionScore, difficultyRating and marketSaturation
       * used to be invented by the model from a business name. Nothing
       * measures them, so nothing writes them. */

      rating: null,
      reviews: null,
      employees: null,
      founded: null,

      country,
      city: city || '',
      serviceId: svc.isCustom ? 'custom' : svc.id,
      serviceLabel: svc.label,
      serviceCustom: svc.isCustom ? svc.label : null,
      status: 'new',
      saved: false,
      notes: '',
      followUpDate: null,
      createdAt: nowIso,
    }
  })
}

/** Rate-of-thumb when the model didn't return one. */
function defaultRate(findingCount) {
  return 400 + Math.min(findingCount, 6) * 100
}

function fallbackWhy(business, findings) {
  if (!findings.length) {
    return `No measurable web-presence issues found for ${business.name} — qualify this one manually.`
  }
  return `${business.name}: ${findings[0].evidence}`
}

function clampInt(value, min, max, fallback) {
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** Models wrap JSON in prose or fences more often than they should. */
export function parseJsonArray(text) {
  if (!text) return []
  const clean = text.trim().replace(/```json\s*/gi, '').replace(/```\s*/g, '')
  const match = clean.match(/\[[\s\S]*\]/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[0])
    return Array.isArray(parsed) ? parsed : []
  } catch {
    try {
      const repaired = match[0]
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
        .replace(/:\s*undefined/g, ':null')
      const parsed = JSON.parse(repaired)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
}

/* ── Writing tools ───────────────────────────────────────────────────────
 * Each of these hands the server the lead's *verified findings*, so the copy
 * cites things the recipient can check.
 * ─────────────────────────────────────────────────────────────────────── */

function leadParams(lead, userName) {
  // A measured local comparison is the most persuasive evidence we have, so it
  // goes in front of the site findings.
  const peerEvidence = benchmarkEvidence(compareToPeers(lead.siteMeasurement, lead.benchmark))

  return {
    userName,
    leadName: lead.name,
    btype: lead.btype,
    location: lead.city || lead.country,
    country: lead.country,
    service: lead.serviceCustom || lead.serviceLabel,
    evidence: [
      ...peerEvidence,
      ...(lead.findings || []).slice(0, 6).map(f => ({
        label: f.label,
        evidence: f.evidence,
      })),
    ].slice(0, 8),
    score: lead.score,
    rate: lead.myMonthlyRate || lead.suggestedMonthlyRate || 800,
    setupCost: lead.setupCost || 200,
  }
}

export const genOutreach = (lead, type, userName) =>
  aiTask(type === 'email' ? 'outreach_email' : 'outreach_call', leadParams(lead, userName))

export const genRoadmap = (lead, userName) => aiTask('roadmap', leadParams(lead, userName))
export const genProposal = (lead, userName) => aiTask('proposal', leadParams(lead, userName))
export const genAudit = (lead, userName) => aiTask('audit', leadParams(lead, userName))
export const genPricingAdvice = lead => aiTask('pricing', leadParams(lead, ''))
export const genScript = (lead, userName) => aiTask('elevator_script', leadParams(lead, userName))
export const genServicePackages = lead => aiTask('packages', leadParams(lead, ''))
export const genFollowUpSequence = (lead, userName) =>
  aiTask('followup_sequence', leadParams(lead, userName))

/* ── Standalone business tools ───────────────────────────────────────── */
export const genInvoice = params => aiTask('invoice', params)
export const genObjectionHandler = params => aiTask('objection', params)
export const genNicheIdeas = params => aiTask('niche', params)
export const genOnboardingKit = params => aiTask('onboarding_kit', params)
export const genRateAdvice = params => aiTask('rate_calc', params)
