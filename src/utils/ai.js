import { BTYPE, SERVICES } from '../constants/services'
import * as DB from './db'
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
export async function generateLeads({ service, country, city, existingNames, lowBudget, count = 5 }) {
  const svc = SERVICES.find(s => s.id === service)
  const loc = city ? city + ", " + country : country
  const globalNames = await DB.getGlobalNames()
  const allAvoid = [...new Set([...existingNames, ...globalNames])].slice(-20).join(", ") || "none"
  const budgetNote = lowBudget ? " setupCost must be under $500." : ""

  const prompt = `You are a JSON API. Return ONLY a valid JSON array, nothing else. No markdown fences, no explanation text, no comments. Start your response with [ and end with ].

Generate exactly ${count} local small business leads in ${loc} for a ${svc.label} freelancer.

Each element:
{"name":"unique local business name","btype":"${BTYPE.slice(0, 12).join('"|"')}","address":"street address in ${loc}","phone":"local number or null","website":"https://url or null","rating":3.8,"reviews":12,"speed":45,"ssl":false,"employees":"3-8","founded":2015,"problems":["issue 1","issue 2"],"why":"one sentence why they need ${svc.label} right now","opportunityScore":72,"demandScore":68,"competitionScore":35,"difficultyRating":"medium","setupCost":350,"suggestedMonthlyRate":900,"toolsCostMonthly":130,"marketSaturation":"competitive"}

Rules: opportunityScore 0-100 (higher=better lead), demandScore 0-100 (market demand), competitionScore 0-100 (lower=less competition=better), difficultyRating easy/medium/hard, marketSaturation underserved/competitive/saturated, suggestedMonthlyRate in USD realistic for ${country}.${budgetNote} NEVER use these names: ${allAvoid}`

  const tokenBudget = Math.min(600 + count * 280, 4000)
  const text = await aiCall(prompt, tokenBudget)

  let clean = text.trim()
  clean = clean.replace(/```json\s*/gi, "").replace(/```\s*/g, "")
  const arrMatch = clean.match(/\[[\s\S]*\]/)
  if (!arrMatch) throw new Error("AI returned unexpected format. Please try again.")
  clean = arrMatch[0]

  let arr
  try {
    arr = JSON.parse(clean)
  } catch (e) {
    try {
      const fixedClean = clean
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/([{,]\s*)(\w+):/g, '$1"$2":')
        .replace(/:\s*undefined/g, ":null")
      arr = JSON.parse(fixedClean)
    } catch (e2) {
      const text2 = await aiCall(prompt + "\n\nIMPORTANT: Return ONLY the JSON array, nothing else.", tokenBudget)
      const clean2 = text2.trim().replace(/```json\s*/gi, "").replace(/```\s*/g, "")
      const match2 = clean2.match(/\[[\s\S]*\]/)
      if (!match2) throw new Error("AI returned unexpected format after retry.")
      arr = JSON.parse(match2[0])
    }
  }

  if (!Array.isArray(arr) || arr.length === 0) throw new Error("No leads returned. Try a different location or service.")

  const leads = arr.map((b, i) => {
    const score = Math.min(98, Math.max(20, b.opportunityScore || (
      30 + (b.ssl === false ? 18 : 0) + (!b.website ? 22 : 0)
      + (b.reviews < 5 ? 15 : b.reviews < 15 ? 8 : 0)
      + (b.speed < 30 ? 14 : b.speed < 50 ? 7 : 0)
      + ((b.problems || []).length * 8) + Math.floor(Math.random() * 10)
    )))
    const suggested = Math.max(200, b.suggestedMonthlyRate || Math.floor(500 + Math.random() * 900))
    const tools = Math.max(20, b.toolsCostMonthly || Math.floor(60 + Math.random() * 160))
    return {
      id: "l_" + Date.now() + "_" + i,
      name: b.name || "Business " + i, btype: b.btype || "Local Business",
      address: b.address || loc, phone: b.phone || null, website: b.website || null,
      rating: b.rating || 3.5, reviews: b.reviews || 8, speed: b.speed || 50, ssl: !!b.ssl,
      employees: b.employees || "2-5", founded: b.founded || 2018,
      problems: b.problems || [], why: b.why || "",
      score,
      suggestedMonthlyRate: suggested, myMonthlyRate: suggested,
      toolsCostMonthly: tools,
      setupCost: Math.max(50, b.setupCost || Math.floor(150 + Math.random() * 350)),
      demandScore: b.demandScore || Math.floor(50 + Math.random() * 40),
      competitionScore: b.competitionScore || Math.floor(20 + Math.random() * 50),
      difficultyRating: b.difficultyRating || "medium",
      marketSaturation: b.marketSaturation || "competitive",
      country, city: city || "", serviceId: service, serviceLabel: svc.label,
      status: "new", saved: false, notes: "", followUpDate: null,
    }
  })

  DB.addGlobalNames(leads.map(l => l.name))
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
  return aiCall(
    "You are a " + lead.serviceLabel + " expert. Write a detailed business audit for " + lead.name + " (" + lead.btype + " in " + (lead.city || lead.country) + ").\n"
    + "Known issues: " + (lead.problems || []).join(", ") + "\nPageSpeed: " + lead.speed + "/100, Reviews: " + lead.reviews + ", Rating: " + lead.rating + ", SSL: " + (lead.ssl ? "Yes" : "No") + "\n\n"
    + "Format the audit as:\nAUDIT SCORE: X/100\n\nCRITICAL ISSUES (2-3 items, each with impact level HIGH/MED/LOW)\n\nQUICK WINS (2-3 things fixable in 30 days)\n\nREVENUE IMPACT: Estimated monthly revenue they're losing\n\nCOMPETITOR BENCHMARK: How they compare to top 3 local competitors\n\nPRIORITY ACTION: The single most important fix\n\nUnder 250 words. Be specific, data-driven, and confident.",
    700)
}

export async function genPricingAdvice(lead) {
  const base = lead.suggestedMonthlyRate || 800
  return aiCall(
    "You are a pricing consultant for " + lead.serviceLabel + " freelancers.\n"
    + "Client: " + lead.name + " (" + lead.btype + ") in " + (lead.city || lead.country) + "\n"
    + "Their issues: " + (lead.problems || []).join(", ") + "\nBusiness size: " + lead.employees + " employees, founded " + lead.founded + "\n"
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
