// ─── Server-side prompt templates ───────────────────────────────────────
//
// Prompts live here, not in the browser. Two reasons:
//   1. The client can no longer send arbitrary text to Claude on our API key —
//      it names a task and passes typed params, so the proxy can't be used as
//      a free general-purpose LLM.
//   2. Prompt wording becomes a server-side deploy, not an app release.
//
// House rule enforced in every template: Claude may write *language* and make
// *pricing judgements*, but it must never state a measurement it wasn't given.
// Numbers that look like data (load times, review counts, competitor
// benchmarks) come from the audit-site function or not at all.

const NO_FABRICATION = `
Hard rules:
- Only reference facts explicitly provided above. Never invent measurements,
  statistics, review counts, competitor names, or revenue figures.
- If you don't have a fact, write around it rather than guessing.
- Do not claim to have visited pages or run tools you weren't given output from.`

/** Trim and flatten a user-supplied string so it can't blow up or restructure the prompt. */
function s(v: unknown, max = 120): string {
  return String(v ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

/** Multi-line user text (notes etc.) — keep newlines but bound the size. */
function block(v: unknown, max = 600): string {
  return String(v ?? "").replace(/\s+$/g, "").slice(0, max)
}

function list(v: unknown, max = 8): string {
  if (!Array.isArray(v)) return "none recorded"
  const items = v.map(x => s(x, 90)).filter(Boolean).slice(0, max)
  return items.length ? items.join("; ") : "none recorded"
}

function money(v: unknown, fallback = 0): number {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

export interface PromptSpec {
  prompt: string
  maxTokens: number
}

type Builder = (p: Record<string, any>) => PromptSpec

/**
 * Turn measured website findings into the evidence block every sales-copy
 * template shares. These strings are facts produced by audit-site.
 */
function evidenceBlock(p: Record<string, any>): string {
  const findings = Array.isArray(p.evidence) ? p.evidence : []
  if (!findings.length) {
    return "Verified findings: none — we could not measure this business's web presence."
  }
  const lines = findings
    .slice(0, 8)
    .map((f: any) => `- ${s(f.label, 80)}: ${s(f.evidence, 160)}`)
    .join("\n")
  return `Verified findings (measured by our crawler — safe to cite as fact):\n${lines}`
}

const BUILDERS: Record<string, Builder> = {
  // ── Scan-time analysis ────────────────────────────────────────────────
  // Deliberately narrow: scoring happens in code from measured signals.
  // Claude supplies the sentence and the pricing judgement only.
  lead_analysis: p => {
    const svc = s(p.service, 60)
    const loc = s(p.location, 80)
    const country = s(p.country, 60)
    const budgetNote = p.lowBudget ? " Setup cost must be under 500." : ""
    const businesses = (Array.isArray(p.businesses) ? p.businesses : [])
      .slice(0, 30)
      .map((b: any, i: number) => ({
        i,
        name: s(b.name, 80),
        type: s(b.btype, 60),
        findings: (Array.isArray(b.findings) ? b.findings : [])
          .slice(0, 6)
          .map((f: any) => s(f, 90)),
      }))

    return {
      maxTokens: Math.min(400 + businesses.length * 130, 3500),
      prompt: `You are a sales analyst helping a ${svc} freelancer in ${loc}.

For each business below you get its name, type, and a list of VERIFIED findings
our crawler measured about its web presence. Findings are facts. An empty
findings list means we found nothing measurable — say so honestly.

Businesses: ${JSON.stringify(businesses)}

Return ONLY a valid JSON array, starting with [ and ending with ]. One element
per business, keyed by index i:
[{"i":0,"why":"one sentence on why they need ${svc} now, referencing a verified finding","angle":"the single strongest finding to open the conversation with","suggestedMonthlyRate":900,"toolsCostMonthly":130,"setupCost":350}]

Rules:
- "why" must reference a verified finding. If findings is empty, write
  "No measurable web-presence issues found — qualify this one manually."
- "angle" must be copied from the findings list, or "" when there are none.
- Rates realistic for a small business in ${country}.${budgetNote}
- Never invent a finding that isn't listed.
- Return ONLY the JSON array.`,
    }
  },

  // ── Outreach ──────────────────────────────────────────────────────────
  outreach_email: p => ({
    maxTokens: 600,
    prompt: `Write a cold email from ${s(p.userName, 60)}, a ${s(p.service, 60)} specialist, to the owner of ${s(p.leadName, 80)} — a ${s(p.btype, 60)} in ${s(p.location, 80)}.

${evidenceBlock(p)}

Rules:
- Subject line first, then a blank line, then the body.
- Under 130 words.
- Open by citing ONE verified finding as a specific, checkable observation.
  This is the whole point of the email: show you actually looked.
- No flattery, no "I hope this email finds you well", no buzzwords.
- Close with a low-friction ask (a 15-minute call, or a reply with a yes/no).
- Sound like a person who noticed something, not a marketer.
${NO_FABRICATION}

Format:
Subject: ...

[body]`,
  }),

  outreach_call: p => ({
    maxTokens: 500,
    prompt: `Write a 90-second phone script for ${s(p.userName, 60)} calling ${s(p.leadName, 80)} (${s(p.btype, 60)}) about ${s(p.service, 60)}.

${evidenceBlock(p)}

Sections: OPENER / HOOK / VALUE / ASK.
Under 110 words. Mark natural pauses as [pause].
The HOOK must cite a verified finding in plain language a non-technical owner
understands.
${NO_FABRICATION}`,
  }),

  followup_sequence: p => ({
    maxTokens: 900,
    prompt: `Write a 5-email follow-up sequence for ${s(p.userName, 60)} following up with ${s(p.leadName, 80)} (${s(p.btype, 60)}) after first contact about ${s(p.service, 60)}.

${evidenceBlock(p)}
Monthly rate discussed: $${money(p.rate, 800)}

Format:
EMAIL 1 (Day 2) - Subject: ...
[body, 60 words]

EMAIL 2 (Day 5) - Subject: ...
[body, 60 words — add a useful tip they can act on without hiring anyone]

EMAIL 3 (Day 10) - Subject: ...
[body, 50 words]

EMAIL 4 (Day 18) - Subject: ...
[body, 50 words]

EMAIL 5 (Day 30) - Subject: ...
[body, 40 words — graceful close-out]

Be human, not corporate. Vary the angle each time; never just "bumping this".
${NO_FABRICATION}`,
  }),

  elevator_script: p => ({
    maxTokens: 400,
    prompt: `Write a 30-second in-person pitch for ${s(p.userName, 60)} meeting the owner of ${s(p.leadName, 80)} (${s(p.btype, 60)}) at a local or networking event.

${evidenceBlock(p)}

Format:
OPENER: [one casual line]
HOOK: [one line naming the problem in owner-friendly language]
VALUE: [one line on what you'd fix]
ASK: [soft ask for a follow-up]

Under 80 words. Natural, not salesy.
${NO_FABRICATION}`,
  }),

  // ── Deliverables ──────────────────────────────────────────────────────
  proposal: p => {
    const rate = money(p.rate, 800)
    const setup = money(p.setupCost, 200)
    return {
      maxTokens: 800,
      prompt: `Write a service proposal from ${s(p.userName, 60)} to the owner of ${s(p.leadName, 80)} (${s(p.btype, 60)} in ${s(p.location, 80)}).

Service: ${s(p.service, 60)}
${evidenceBlock(p)}
Monthly fee: $${rate}
Setup: $${setup}

Format:
SUBJECT: [specific, not generic]

EXECUTIVE SUMMARY (2 sentences)

WHAT WE FOUND
[one bullet per verified finding, quoting the measurement]

WHAT WE'LL DO
[3-4 bullets, each mapped to a finding above]

INVESTMENT
Setup: $${setup} (one-time)
Monthly: $${rate}/month

NEXT STEPS (2 sentences)

Under 300 words. Professional but human. Every claim in WHAT WE FOUND must come
from the verified findings — this document may be sent to the business owner,
who can check it.
${NO_FABRICATION}`,
    }
  },

  audit: p => ({
    maxTokens: 800,
    prompt: `You are a ${s(p.service, 60)} expert writing a web-presence audit for ${s(p.leadName, 80)} (${s(p.btype, 60)} in ${s(p.location, 80)}).

${evidenceBlock(p)}
Measured score: ${money(p.score, 0)}/100 (derived from the findings above)

Format:
AUDIT SCORE: ${money(p.score, 0)}/100

WHAT WE MEASURED
[one line per verified finding, restating the measurement plainly]

CRITICAL ISSUES (up to 3, each tagged HIGH/MED/LOW)
[only issues supported by a finding]

QUICK WINS (2-3 fixable within 30 days)

PRIORITY ACTION
[the single most important fix, and why]

Under 260 words. Confident and concrete.
Do NOT include estimated revenue loss, traffic numbers, or competitor
comparisons — we have not measured those and this document may be sent to the
business owner.
${NO_FABRICATION}`,
  }),

  roadmap: p => ({
    maxTokens: 600,
    prompt: `Create a 30-60-90 day plan for ${s(p.userName, 60)} to win ${s(p.leadName, 80)} as a ${s(p.service, 60)} client.

Business: ${s(p.btype, 60)} in ${s(p.location, 80)}
${evidenceBlock(p)}

Format:
DAY 1-30: [3-4 specific actions]
DAY 31-60: [3-4 specific actions]
DAY 61-90: [3-4 specific actions]
KEY METRICS: [2-3 measurable success metrics]

Under 220 words. Specific and actionable — no filler like "build rapport".
${NO_FABRICATION}`,
  }),

  pricing: p => ({
    maxTokens: 600,
    prompt: `You are a pricing consultant for ${s(p.service, 60)} freelancers.

Client: ${s(p.leadName, 80)} (${s(p.btype, 60)}) in ${s(p.location, 80)}
Country (for market rates): ${s(p.country, 60)}
${evidenceBlock(p)}
Baseline suggested rate: $${money(p.rate, 800)}/month

Format:
RECOMMENDED RATE: $X/month
WHY THIS RATE: (2 sentences of market context for ${s(p.country, 60)})

PRICING OPTIONS:
• Starter: $X/mo — [included]
• Growth: $X/mo — [included]
• Premium: $X/mo — [included]

HOW TO PITCH IT: (2 sentences)
NEVER GO BELOW: $X/month (and why)

Under 220 words. Frame these as judgement calls, not market data.
${NO_FABRICATION}`,
  }),

  packages: p => ({
    maxTokens: 700,
    prompt: `Create 3 service packages for a ${s(p.service, 60)} freelancer targeting ${s(p.leadName, 80)} (${s(p.btype, 60)}) in ${s(p.location, 80)}.

${evidenceBlock(p)}
Baseline rate: $${money(p.rate, 800)}/mo

Format:
STARTER PACKAGE - $X/mo
[3 deliverables]
Best for: [who]

GROWTH PACKAGE - $X/mo (RECOMMENDED)
[4-5 deliverables]
Best for: [who]

PREMIUM PACKAGE - $X/mo
[6+ deliverables]
Best for: [who]

UPSELL TIP: [one sentence]

Deliverables should map to the verified findings where possible. Prices
realistic for ${s(p.country, 60)}. Under 240 words.
${NO_FABRICATION}`,
  }),

  // ── Business tools (not lead-specific) ────────────────────────────────
  invoice: p => ({
    maxTokens: 600,
    prompt: `Write a professional invoice.

From: ${s(p.userName, 60)}
To: ${s(p.client, 80) || "Client"}
Service: ${s(p.service, 80) || "Freelance services"}
Amount: $${money(p.amount, 0)}
Hours: ${s(p.hours, 20) || "not specified"}
Notes: ${block(p.notes, 300) || "none"}

Format as invoice text:
INVOICE #[4-digit number]
Date: [today]
Due: [14 days from today]
BILL TO / FROM / DESCRIPTION / AMOUNT / TOTAL / PAYMENT TERMS / short thank-you.

Under 220 words.`,
  }),

  objection: p => ({
    maxTokens: 700,
    prompt: `You are a sales coach for freelancers selling ${s(p.service, 60)}.

The prospect said: "${s(p.objection, 300)}"
Freelancer: ${s(p.userName, 60)}

Write 3 rebuttals:
REBUTTAL 1 — Empathy + reframe (under 60 words, end with a soft question)
REBUTTAL 2 — Social proof, described generically since you have no case studies
             for this freelancer (under 60 words, end with a soft question)
REBUTTAL 3 — Direct close (under 60 words, end with a soft question)
${NO_FABRICATION}`,
  }),

  niche: p => ({
    maxTokens: 900,
    prompt: `You are a market research consultant for freelancers.

Country: ${s(p.country, 60)}
Service: ${s(p.service, 60)}

Suggest 5 niches worth testing, formatted:

1. [NICHE] — Typical rate: $X-Y/mo | Why it may be underserved: [1 sentence] | Where to find them: [specific source] | Opening angle: [1 sentence]

(repeat for 2-5)

Be specific to ${s(p.country, 60)}. Under 320 words.
Present these as informed hypotheses to validate, not measured market data.
Do NOT state market sizes or competition levels as fact.
${NO_FABRICATION}`,
  }),

  onboarding_kit: p => ({
    maxTokens: 900,
    prompt: `Create a client onboarding kit.

Freelancer: ${s(p.userName, 60)}
Client: ${s(p.client, 80) || "New Client"}
Service: ${s(p.service, 60)}
Rate: $${money(p.rate, 0)}/mo

1. WELCOME EMAIL (80 words, warm and professional)
2. ONBOARDING CHECKLIST (6-8 items the client must provide)
3. MONTH 1 DELIVERABLES (3 bullets)
4. COMMUNICATION RULES (response times, reporting cadence)

Under 300 words.`,
  }),

  rate_calc: p => ({
    maxTokens: 700,
    prompt: `You are a freelance pricing expert.

Country: ${s(p.country, 60)}
Service: ${s(p.service, 60)}
Experience level: ${s(p.experience, 40) || "intermediate"}
Hours per client per month: ${s(p.hours, 10) || "10"}

Format:
MARKET RATES (typical, not measured):
• Entry: $X/mo
• Mid: $X/mo
• Premium: $X/mo

YOUR RATE: $X/mo — WHY: [2 sentences]
HOURLY EQUIVALENT: $X/hr
HOW TO JUSTIFY IT: [2 sentences to say to clients]
GETTING TO THE NEXT TIER: [how to charge 30% more]

Under 220 words. Be explicit that these are informed estimates.
${NO_FABRICATION}`,
  }),
}

export const TASKS = Object.keys(BUILDERS)

export function buildPrompt(task: string, params: Record<string, any>): PromptSpec | null {
  const builder = BUILDERS[task]
  if (!builder) return null
  return builder(params || {})
}
