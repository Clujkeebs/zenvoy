import { SERVICES } from '../constants/services'
import { fetchRealBusinesses } from './places'
import { supabase } from '../lib/supabase'

/* ── Core AI Call (via Supabase Edge Function) ──────────── */
const MAX_RETRIES = 2
const RETRY_CODES = new Set([429, 503, 529])

const AI_URL = import.meta.env.VITE_SUPABASE_URL + "/functions/v1/ai-proxy"

export async function aiCall(prompt, maxTokens = 1000, attempt = 0) {
  // Get session token for auth
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token || ""

  let res
  try {
    res = await fetch(AI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + token,
      },
      body: JSON.stringify({ prompt, max_tokens: maxTokens }),
    })
  } catch (e) {
    if (e.name === "AbortError") throw new Error("Request cancelled.")
    throw new Error("Network error — check your internet connection.")
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    if (RETRY_CODES.has(res.status) && attempt < MAX_RETRIES) {
      const delay = Math.min(1500 * Math.pow(2, attempt), 8000)
      await new Promise(r => setTimeout(r, delay))
      return aiCall(prompt, maxTokens, attempt + 1)
    }
    throw new Error(err?.error || "AI service error " + res.status)
  }
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.text || ""
}

/* ── Lead Generation ────────────────────────────────────── */

/**
 * Enrich a list of real businesses with AI analysis.
 * The AI analyses them — it does NOT invent names, addresses, or phone numbers.
 */
async function enrichWithAI(businesses, svc, country, city, lowBudget) {
  const loc = city ? city + ", " + country : country
  const budgetNote = lowBudget ? " setupCost must be under $500." : ""

  // Send only the fields the AI needs for analysis
  const bList = businesses.map((b, i) => ({
    i,
    name:       b.name,
    btype:      b.btype,
    hasWebsite: !!b.website,
    hasPhone:   !!b.phone,
    hasSsl:     b.ssl,
  }))

  const prompt = `You are a freelance sales analyst. Analyse these REAL local businesses for a ${svc.label} freelancer in ${loc}.

Businesses: ${JSON.stringify(bList)}

Return ONLY a valid JSON array — no markdown, no explanation. Start with [ and end with ].
Each element corresponds to a business by its index i:
[{"i":0,"problems":["specific issue 1","specific issue 2"],"why":"one sentence why they need ${svc.label} right now","opportunityScore":72,"demandScore":68,"competitionScore":35,"difficultyRating":"easy|medium|hard","marketSaturation":"underserved|competitive|saturated","suggestedMonthlyRate":900,"toolsCostMonthly":130,"setupCost":350},...]

Rules:
- opportunityScore 0-100 (higher = better lead for this service)
- If hasWebsite is false, include "No online presence" in problems
- If hasPhone is false, include "No contact info listed" in problems
- suggestedMonthlyRate realistic for ${country}${budgetNote}
- Return ONLY the JSON array`

  const tokenBudget = Math.min(500 + businesses.length * 200, 3500)

  /* Heuristic fallback if AI fails */
  const heuristic = (b, i) => ({
    i,
    problems: [
      !b.website ? "No online presence"      : "Outdated or weak website",
      !b.phone   ? "No contact info listed"  : "Limited digital reach",
    ],
    why: `${b.name} could grow significantly with better ${svc.label.toLowerCase()}.`,
    opportunityScore:  50 + Math.floor((!b.website ? 15 : 0) + (!b.phone ? 10 : 0) + Math.random() * 15),
    demandScore:       55,
    competitionScore:  40,
    difficultyRating:  "medium",
    marketSaturation:  "competitive",
    suggestedMonthlyRate: 700,
    toolsCostMonthly:     100,
    setupCost:            300,
  })

  let arr
  try {
    const text  = await aiCall(prompt, tokenBudget)
    let   clean = text.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "")
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error("no array")
    clean = match[0]
    try {
      arr = JSON.parse(clean)
    } catch {
      const fixed = clean
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
        .replace(/:\s*undefined/g, ":null")
      arr = JSON.parse(fixed)
    }
  } catch {
    // AI failed — use heuristic scores on real businesses (still better than fake data)
    return businesses.map(heuristic)
  }

  if (!Array.isArray(arr)) return businesses.map(heuristic)

  // Map back by index, fill any gaps with heuristic
  return businesses.map((b, i) => {
    const a = arr.find(x => x.i === i) ?? arr[i]
    return a ?? heuristic(b, i)
  })
}

/**
 * Generate leads by:
 *   1. Fetching REAL businesses from OpenStreetMap (free, no API key)
 *   2. Having the AI *analyse* those real businesses (not invent them)
 */
export async function generateLeads({ service, country, city, existingNames, lowBudget, count = 5 }) {
  const svc = SERVICES.find(s => s.id === service)
  const loc = city ? city + ", " + country : country

  /* ── Step 1: Real businesses from OpenStreetMap ─────── */
  const pool = await fetchRealBusinesses({ city, country })

  /* ── Step 2: Filter out businesses this user already has */
  const filtered = pool.filter(b => !existingNames.includes(b.name))
  if (filtered.length === 0) {
    throw new Error(`All businesses found in ${loc} are already in your leads. Try a different city.`)
  }

  /* Take up to count*2 as working set (AI trims to count after scoring) */
  const workSet = filtered.slice(0, count * 2)

  /* ── Step 3: AI analyses real businesses ────────────── */
  const enriched = await enrichWithAI(workSet, svc, country, city, lowBudget)

  /* ── Step 4: Merge real data with AI analysis ───────── */
  const leads = enriched.slice(0, count).map((analysis, i) => {
    const real      = workSet[i]
    const score     = Math.min(98, Math.max(20, analysis.opportunityScore ?? 50))
    const suggested = Math.max(200, analysis.suggestedMonthlyRate ?? 700)
    const tools     = Math.max(20,  analysis.toolsCostMonthly     ?? 80)

    return {
      id: "l_" + Date.now() + "_" + i,
      /* ── From OpenStreetMap (real, verified) ─── */
      name:    real.name,
      btype:   real.btype,
      address: real.address,
      phone:   real.phone    ?? null,
      website: real.website  ?? null,
      ssl:     real.ssl,
      /* ── AI analysis of the real business ────── */
      problems:          analysis.problems         ?? [],
      why:               analysis.why              ?? "",
      score,
      demandScore:       analysis.demandScore      ?? Math.floor(50 + Math.random() * 40),
      competitionScore:  analysis.competitionScore ?? Math.floor(20 + Math.random() * 50),
      difficultyRating:  analysis.difficultyRating ?? "medium",
      marketSaturation:  analysis.marketSaturation ?? "competitive",
      suggestedMonthlyRate: suggested,
      myMonthlyRate:        suggested,
      toolsCostMonthly:     tools,
      setupCost: Math.max(50, analysis.setupCost ?? 200),
      /* ── OSM doesn't carry these; left null ──── */
      rating:    null,
      reviews:   null,
      speed:     null,
      employees: null,
      founded:   null,
      /* ── Context ─────────────────────────────── */
      country, city: city || "",
      serviceId:    service,
      serviceLabel: svc.label,
      status: "new", saved: false, notes: "", followUpDate: null,
    }
  })

  return leads
}

/* ── AI Writing Tools ───────────────────────────────────── */
export async function genOutreach(lead, type, userName) {
  const prob = (lead.problems || [])[0] || "poor online presence"
  const isEmail = type === "email"
  return aiCall(isEmail
    ? "Write a cold email from " + userName + " (" + lead.serviceLabel + " specialist) to the owner of " + lead.name + ", a " + lead.btype + " in " + (lead.city || lead.country) + ".\nKey issue: " + lead.why + "\nRules: Subject line first. Under 120 words. Mention problem: '" + prob + "'. Soft CTA for 15-min call. Sound human.\nFormat:\nSubject: ...\n\n[body]"
    : "Write a 90-second phone script for " + userName + " calling " + lead.name + " (" + lead.btype + ").\nIssue: " + lead.why + "\nSections: OPENER / HOOK / VALUE / ASK. Under 100 words. Mark pauses [pause].",
    500)
}

export async function genRoadmap(lead, userName) {
  return aiCall("Create a 30-60-90 day action plan for " + userName + " to win " + lead.name + " as a " + lead.serviceLabel + " client.\n"
    + "Business: " + lead.btype + " in " + (lead.city || lead.country) + "\nIssues: " + (lead.problems || []).join(", ") + "\nOpportunity: " + lead.why + "\n\n"
    + "Format as:\nDAY 1-30: [3-4 specific actions]\nDAY 31-60: [3-4 specific actions]\nDAY 61-90: [3-4 specific actions]\nKEY METRICS: [2-3 success metrics]\n\nBe specific and actionable. Under 200 words.",
    600)
}

export async function genProposal(lead, userName) {
  const rate = lead.myMonthlyRate || lead.suggestedMonthlyRate || 800
  return aiCall(
    "Write a professional service proposal from " + userName + " to the owner of " + lead.name + " (" + lead.btype + " in " + (lead.city || lead.country) + ").\n"
    + "Service: " + lead.serviceLabel + "\nKey problems identified: " + (lead.problems || []).join(", ") + "\n"
    + "Monthly fee: $" + rate + "\nSetup cost: $" + (lead.setupCost || 200) + "\n\n"
    + "Format:\nSUBJECT: [compelling proposal subject]\n\nEXECUTIVE SUMMARY (2 sentences)\n\nWHAT WE FOUND (3 bullet points about their specific problems)\n\nWHAT WE'LL DO (3-4 bullet points of deliverables)\n\nINVESTMENT\nSetup: $" + lead.setupCost + " (one-time)\nMonthly retainer: $" + rate + "/month\n\nNEXT STEPS (2 sentences)\n\nKeep it under 280 words. Sound professional but human.",
    700)
}

export async function genAudit(lead, userName) {
  const speedStr   = lead.speed    != null ? lead.speed + "/100"  : "not measured"
  const reviewsStr = lead.reviews  != null ? String(lead.reviews) : "unknown"
  const ratingStr  = lead.rating   != null ? String(lead.rating)  : "unknown"
  const sslStr     = lead.ssl ? "Yes" : (lead.website ? "No" : "No website")
  return aiCall(
    "You are a " + lead.serviceLabel + " expert. Write a detailed business audit for " + lead.name + " (" + lead.btype + " in " + (lead.city || lead.country) + ").\n"
    + "Known issues: " + (lead.problems || []).join(", ") + "\nPageSpeed: " + speedStr + ", Reviews: " + reviewsStr + ", Rating: " + ratingStr + ", SSL: " + sslStr + "\n\n"
    + "Format the audit as:\nAUDIT SCORE: X/100\n\nCRITICAL ISSUES (2-3 items, each with impact level HIGH/MED/LOW)\n\nQUICK WINS (2-3 things fixable in 30 days)\n\nREVENUE IMPACT: Estimated monthly revenue they're losing\n\nCOMPETITOR BENCHMARK: How they compare to top 3 local competitors\n\nPRIORITY ACTION: The single most important fix\n\nUnder 250 words. Be specific, data-driven, and confident.",
    700)
}

export async function genPricingAdvice(lead) {
  const base      = lead.suggestedMonthlyRate || 800
  const sizeStr   = lead.employees != null ? lead.employees + " employees" : "size unknown"
  const foundStr  = lead.founded   != null ? "founded " + lead.founded    : "founding year unknown"
  return aiCall(
    "You are a pricing consultant for " + lead.serviceLabel + " freelancers.\n"
    + "Client: " + lead.name + " (" + lead.btype + ") in " + (lead.city || lead.country) + "\n"
    + "Their issues: " + (lead.problems || []).join(", ") + "\nBusiness size: " + sizeStr + ", " + foundStr + "\n"
    + "AI suggested rate: $" + base + "/month\n\n"
    + "Give a pricing breakdown in this format:\nRECOMMENDED RATE: $X/month\nWHY THIS RATE: (2 sentences - market context for " + lead.country + ")\n\nPRICING OPTIONS:\n• Starter Package: $X/mo - [what's included]\n• Growth Package: $X/mo - [what's included]\n• Premium Package: $X/mo - [what's included]\n\nHOW TO PITCH THE PRICE: (2 sentences of negotiation advice)\n\nNEVER GO BELOW: $X/month (and why)\n\nUnder 200 words.",
    600)
}

export async function genScript(lead, userName) {
  return aiCall(
    "Write a punchy 30-second elevator pitch script for " + userName + " to use when meeting " + lead.name + " (" + lead.btype + ") in person or at a networking event.\n"
    + "Their main problem: " + lead.why + "\n\nFormat:\nOPENER: [1 casual sentence to break the ice]\nHOOK: [1 sentence that identifies their pain]\nVALUE: [1 sentence on what you fix]\nASK: [soft ask for a follow-up chat]\n\nUnder 80 words total. Sound natural, not salesy.",
    400)
}

export async function genServicePackages(lead) {
  const rate = lead.suggestedMonthlyRate || 800
  return aiCall(
    "You are a freelance business consultant. Create 3 service packages for a " + lead.serviceLabel + " freelancer targeting " + lead.name + " (" + lead.btype + ") in " + (lead.city || lead.country) + ".\n"
    + "Their specific problems: " + (lead.problems || []).join(", ") + "\nAI baseline suggested rate: $" + rate + "/mo\n\n"
    + "Format each package as:\nSTARTER PACKAGE - $X/mo\n[3 deliverables]\nBest for: [who this suits]\n\nGROWTH PACKAGE - $X/mo (RECOMMENDED)\n[4-5 deliverables]\nBest for: [who this suits]\n\nPREMIUM PACKAGE - $X/mo\n[6+ deliverables + extras]\nBest for: [who this suits]\n\nUPSELL TIP: [one sentence on how to move them from Starter to Growth]\n\nKeep prices realistic for " + lead.country + ". Under 220 words.",
    700)
}

export async function genFollowUpSequence(lead, userName) {
  const rate = lead.myMonthlyRate || lead.suggestedMonthlyRate || 800
  return aiCall(
    "Write a 5-email follow-up sequence for " + userName + " following up with " + lead.name + " (" + lead.btype + ") after initial contact.\n"
    + "Service: " + lead.serviceLabel + "\nTheir issue: " + lead.why + "\nMonthly rate: $" + rate + "\n\n"
    + "Format as:\nEMAIL 1 (Day 2) - Subject: ...\n[body 60 words]\n\nEMAIL 2 (Day 5) - Subject: ...\n[body 60 words, add value/tip]\n\nEMAIL 3 (Day 10) - Subject: ...\n[body 50 words, social proof]\n\nEMAIL 4 (Day 18) - Subject: ...\n[body 50 words, urgency/scarcity]\n\nEMAIL 5 (Day 30) - Subject: ...\n[body 40 words, final breakup email]\n\nBe human, not corporate.",
    900)
}
