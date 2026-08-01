/* ── evidence.js — turn measurements into findings and a score ───────────
 *
 * The old pipeline asked Claude for a "demandScore" and a "competitionScore"
 * from a business name and two booleans. Those numbers were invented, and a
 * user who checked them would find nothing behind them.
 *
 * This module replaces that with something defensible: every finding below is
 * derived from something the audit-site function actually observed, carries the
 * measurement as a quotable string, and contributes a fixed weight to the
 * score. Same input always gives the same score, and every point of it can be
 * traced to a fact.
 *
 * Design notes:
 *  - `evidence` is written to be read aloud to a business owner. It has to
 *    survive them checking it.
 *  - Weights express "how much does this make them a good prospect", not "how
 *    bad is this site".
 *  - Relevance is per-service: a missing booking link matters to someone
 *    selling automation and not at all to someone selling logos.
 * ──────────────────────────────────────────────────────────────────────── */

/** Finding categories, used to decide which findings matter for a service. */
export const CATEGORIES = [
  "presence", "mobile", "speed", "security", "seo",
  "contact", "booking", "tracking", "social", "content", "platform",
]

/**
 * Which categories matter for each preset service.
 * 1.0 = the thing they're selling. 0.4 = supporting evidence. Absent = ignored.
 */
export const SERVICE_RELEVANCE = {
  web:     { presence: 1, mobile: 1, speed: 1, security: 1, platform: 1, content: 0.4, seo: 0.4 },
  seo:     { seo: 1, speed: 1, content: 1, presence: 0.4, security: 0.4, tracking: 0.4 },
  social:  { social: 1, presence: 1, content: 0.4, tracking: 0.4 },
  phone:   { contact: 1, booking: 1, presence: 0.4 },
  ads:     { presence: 1, tracking: 1, speed: 0.4, mobile: 0.4, content: 0.4 },
  rep:     { social: 1, contact: 1, presence: 0.4, content: 0.4 },
  email:   { contact: 1, content: 1, tracking: 0.4 },
  local:   { presence: 1, contact: 1, seo: 1, mobile: 0.4 },
  chat:    { contact: 1, booking: 1, presence: 0.4 },
  content: { content: 1, seo: 1, social: 0.4, presence: 0.4 },
  crm:     { contact: 1, booking: 1, tracking: 0.4 },
  brand:   { presence: 1, platform: 1, content: 1, mobile: 0.4 },
}

/**
 * Fallback for a service the user typed themselves. Everything counts, but
 * nothing is weighted as the headline — we don't know what they sell, so we
 * don't pretend to.
 */
export const CUSTOM_RELEVANCE = CATEGORIES.reduce((acc, c) => {
  acc[c] = 0.7
  return acc
}, {})

export function relevanceFor(serviceId) {
  return SERVICE_RELEVANCE[serviceId] || CUSTOM_RELEVANCE
}

const YEAR = new Date().getFullYear()

/** Round to one decimal without floating-point noise in the UI. */
const oneDp = n => Math.round(n * 10) / 10

/**
 * Derive findings from a business record plus its site measurement.
 *
 * @param {Object} business  — OSM record: { name, website, phone, btype }
 * @param {Object|null} m    — SiteMeasurement from audit-site, or null when
 *                             there was no website to measure.
 * @returns {Array} findings — [{ id, category, label, evidence, weight, fix }]
 */
export function deriveFindings(business, m) {
  const f = []
  const add = (id, category, label, evidence, weight, fix) =>
    f.push({ id, category, label, evidence, weight, fix })

  // ── No website at all ───────────────────────────────────────────────
  if (!business.website) {
    add(
      "no_website", "presence",
      "No website",
      "No website listed in public business data for this location.",
      40,
      "Build a one-page site with services, hours, location and a call button.",
    )
  }

  if (!business.phone) {
    add(
      "no_listed_phone", "contact",
      "No phone number listed",
      "No phone number published in public business data.",
      14,
      "Add a click-to-call number to the listing and site header.",
    )
  }

  // Nothing measured — either no site, or the audit hasn't run yet.
  if (!m) return f

  // ── Site exists but doesn't work ────────────────────────────────────
  if (!m.reachable) {
    const detail = m.error || `returned status ${m.status ?? "unknown"}`
    add(
      "site_unreachable", "presence",
      "Website doesn't load",
      `${hostOf(m.url)} did not load when we checked: ${detail}.`,
      34,
      "Restore hosting/DNS, or replace with a working single-page site.",
    )
    return f
  }

  if (m.looksParked) {
    add(
      "site_parked", "presence",
      "Domain is parked",
      `${hostOf(m.url)} serves a placeholder or "coming soon" page rather than a real site.`,
      30,
      "Replace the placeholder with real content — services, hours, contact.",
    )
  }

  // ── Security ────────────────────────────────────────────────────────
  if (m.https === false) {
    add(
      "no_https", "security",
      "No HTTPS",
      `${hostOf(m.url)} serves over plain http, so browsers show a "Not secure" warning to visitors.`,
      24,
      "Install a TLS certificate and redirect http to https.",
    )
  }

  // ── Mobile ──────────────────────────────────────────────────────────
  if (m.hasViewport === false) {
    add(
      "no_viewport", "mobile",
      "Not built for mobile",
      "The page has no mobile viewport tag, so phones render the desktop layout zoomed out.",
      22,
      "Add responsive styling and a viewport meta tag.",
    )
  }

  // ── Speed ───────────────────────────────────────────────────────────
  if (typeof m.responseMs === "number") {
    if (m.responseMs >= 4000) {
      add(
        "very_slow", "speed",
        "Very slow to respond",
        `The homepage took ${oneDp(m.responseMs / 1000)}s to respond when we measured it.`,
        20,
        "Move to faster hosting, enable caching and compress images.",
      )
    } else if (m.responseMs >= 2000) {
      add(
        "slow", "speed",
        "Slow to respond",
        `The homepage took ${oneDp(m.responseMs / 1000)}s to respond when we measured it.`,
        12,
        "Enable caching/CDN and compress the largest assets.",
      )
    }
  }

  if (typeof m.htmlBytes === "number" && m.htmlBytes > 250_000) {
    add(
      "heavy_html", "speed",
      "Very heavy page",
      `The homepage HTML alone is ${Math.round(m.htmlBytes / 1024)}KB before images or scripts.`,
      6,
      "Trim page builder bloat and split content across pages.",
    )
  }

  // ── Search basics ───────────────────────────────────────────────────
  if (!m.title) {
    add(
      "no_title", "seo",
      "No page title",
      "The homepage has no <title>, so search results and browser tabs show a bare URL.",
      14,
      "Write a title in the form 'Service — Business Name — City'.",
    )
  } else if (m.title.length < 15) {
    add(
      "weak_title", "seo",
      "Thin page title",
      `The homepage title is just "${m.title}" — no service or location for search engines to match.`,
      10,
      "Rewrite as 'Service — Business Name — City'.",
    )
  }

  if (m.hasMetaDescription === false) {
    add(
      "no_meta_description", "seo",
      "No search description",
      "The homepage has no meta description, so Google invents the snippet shown in results.",
      8,
      "Write a 150-character description with the service and location.",
    )
  }

  if (m.hasStructuredData === false) {
    add(
      "no_structured_data", "seo",
      "No structured data",
      "The site publishes no LocalBusiness schema, so hours, address and rating can't appear in search results.",
      8,
      "Add LocalBusiness JSON-LD with address, hours and phone.",
    )
  }

  // ── Getting hold of them ────────────────────────────────────────────
  if (m.hasPhoneLink === false) {
    add(
      "no_phone_link", "contact",
      "No tap-to-call",
      "No clickable phone link anywhere on the homepage — mobile visitors have to copy the number by hand.",
      14,
      "Add a tel: link in the header and footer.",
    )
  }

  if (m.hasContactForm === false && m.hasEmailLink === false) {
    add(
      "no_contact_route", "contact",
      "No way to make contact online",
      "The homepage has no contact form and no email link.",
      16,
      "Add a short contact form and a visible email address.",
    )
  }

  if (m.hasBookingLink === false) {
    add(
      "no_booking", "booking",
      "No online booking",
      "No booking or scheduling link found — every appointment has to go through a phone call.",
      12,
      "Add online scheduling so enquiries convert outside business hours.",
    )
  }

  // ── Marketing maturity ──────────────────────────────────────────────
  if (m.hasAnalytics === false) {
    add(
      "no_analytics", "tracking",
      "No analytics installed",
      "No analytics or pixel found, so the business has no data on where its visitors come from.",
      10,
      "Install analytics and set up conversion tracking for calls and forms.",
    )
  }

  if (Array.isArray(m.socialLinks) && m.socialLinks.length === 0) {
    add(
      "no_social", "social",
      "No social profiles linked",
      "The homepage links to no social accounts at all.",
      14,
      "Claim the main profiles for the category and link them from the site.",
    )
  }

  // ── Signs of neglect ────────────────────────────────────────────────
  if (typeof m.copyrightYear === "number" && m.copyrightYear < YEAR - 1) {
    const age = YEAR - m.copyrightYear
    add(
      "stale_copyright", "content",
      "Site looks abandoned",
      `The footer still reads © ${m.copyrightYear} — ${age} year${age > 1 ? "s" : ""} out of date.`,
      12,
      "Refresh content and automate the footer year.",
    )
  }

  if (m.platform && ["Wix", "GoDaddy", "Weebly"].includes(m.platform)) {
    add(
      "diy_platform", "platform",
      `Built on ${m.platform}`,
      `The site is a ${m.platform} template build, which usually means nobody is maintaining it professionally.`,
      8,
      "Offer a rebuild or an ongoing maintenance retainer.",
    )
  }

  return f
}

const SCORE_CAP = 60   // relevant weight at which a lead is as good as it gets
const SCORE_BASE = 10  // a business with zero findings still isn't a zero

/**
 * Score a lead for a specific service from its findings.
 *
 * Returns the score plus the relevant findings sorted strongest-first, so the
 * UI and the AI prompts both work from the same ordered evidence.
 */
export function scoreFindings(findings, serviceId) {
  const relevance = relevanceFor(serviceId)

  const weighted = findings
    .map(f => ({ ...f, relevance: relevance[f.category] ?? 0 }))
    .filter(f => f.relevance > 0)
    .map(f => ({ ...f, effectiveWeight: f.weight * f.relevance }))
    .sort((a, b) => b.effectiveWeight - a.effectiveWeight)

  const raw = weighted.reduce((sum, f) => sum + f.effectiveWeight, 0)
  const score = Math.min(98, Math.round(SCORE_BASE + 85 * Math.min(raw, SCORE_CAP) / SCORE_CAP))

  return { score, findings: weighted, raw: Math.round(raw) }
}

/** Honest bucketing for the UI — including "don't bother". */
export function opportunityLabel(score, findingCount) {
  if (findingCount === 0) return { label: "No issues found", tone: "muted" }
  if (score >= 75) return { label: "Strong lead", tone: "green" }
  if (score >= 50) return { label: "Worth a look", tone: "lime" }
  if (score >= 30) return { label: "Weak lead", tone: "amber" }
  return { label: "Probably well served", tone: "muted" }
}

/** Short human summary — "4 verified issues · no HTTPS, not mobile-ready". */
export function summarize(findings, max = 2) {
  if (!findings.length) return "No measurable issues found"
  const n = findings.length
  const head = findings.slice(0, max).map(f => f.label.toLowerCase()).join(", ")
  return `${n} verified issue${n > 1 ? "s" : ""} · ${head}`
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return String(url || "the site")
  }
}
