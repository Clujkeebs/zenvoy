// ─── Website measurement ────────────────────────────────────────────────
//
// Fetches a business's website and reports what is actually there. Everything
// in `SiteMeasurement` is observed, never inferred — that's the whole point.
// Scoring and copywriting happen elsewhere; this module only measures.
//
// Runs server-side because a browser can't do it: cross-origin reads are
// blocked, response headers are invisible, and timing is unreliable.

const FETCH_TIMEOUT_MS = 8000
const MAX_HTML_BYTES = 400_000
const MAX_REDIRECTS = 3

export interface SiteMeasurement {
  url: string
  reachable: boolean
  error?: string
  status?: number
  finalUrl?: string
  https?: boolean
  httpRedirectsToHttps?: boolean
  responseMs?: number
  htmlBytes?: number
  hasViewport?: boolean
  title?: string
  hasMetaDescription?: boolean
  hasPhoneLink?: boolean
  hasEmailLink?: boolean
  hasContactForm?: boolean
  hasBookingLink?: boolean
  bookingProvider?: string
  hasAnalytics?: boolean
  hasStructuredData?: boolean
  socialLinks?: string[]
  copyrightYear?: number
  platform?: string
  looksParked?: boolean
  measuredAt: string
}

/**
 * Reject URLs that point inside our own network. An authenticated caller could
 * otherwise use this function to probe internal services (SSRF).
 *
 * Note: this blocks literal private addresses and known-local hostnames. It
 * does not defend against a hostile DNS record resolving to a private IP; that
 * needs egress filtering at the network layer.
 */
const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^\[?::1\]?$/,
  /^0\./,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,                          // link-local, incl. cloud metadata
  /^172\.(1[6-9]|2\d|3[01])\./,           // 172.16.0.0/12
  /^metadata\./i,
]

function isSafeUrl(raw: string): URL | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null
  const host = u.hostname
  if (!host || !host.includes(".") && !host.startsWith("[")) return null
  if (BLOCKED_HOST_PATTERNS.some(re => re.test(host))) return null
  return u
}

/** Fetch following redirects manually so every hop gets re-validated. */
async function safeFetch(startUrl: URL): Promise<{ res: Response; finalUrl: URL; hops: URL[] }> {
  let current = startUrl
  const hops: URL[] = [startUrl]

  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(current.toString(), {
      redirect: "manual",
      headers: {
        // Identify honestly. Some hosts block unknown agents outright.
        "User-Agent": "ZenvyloBot/1.0 (+https://zenvylo.com/bot; web presence audit)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.get("location")
    if (!isRedirect) return { res, finalUrl: current, hops }

    const next = isSafeUrl(new URL(res.headers.get("location")!, current).toString())
    if (!next) throw new Error("Redirect to a blocked address")
    await res.body?.cancel()
    current = next
    hops.push(next)
  }
  throw new Error("Too many redirects")
}

/** Read at most MAX_HTML_BYTES of the body so a huge page can't exhaust memory. */
async function readCapped(res: Response): Promise<string> {
  if (!res.body) return ""
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    total += value.length
  }
  await reader.cancel().catch(() => {})
  const buf = new Uint8Array(total)
  let off = 0
  for (const c of chunks) {
    const take = Math.min(c.length, total - off)
    buf.set(c.subarray(0, take), off)
    off += take
    if (off >= total) break
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf)
}

const BOOKING_PROVIDERS: Array<[string, RegExp]> = [
  ["Calendly", /calendly\.com/i],
  ["Booksy", /booksy\.com/i],
  ["Fresha", /fresha\.com/i],
  ["Square", /squareup\.com|square\.site/i],
  ["OpenTable", /opentable\./i],
  ["Acuity", /acuityscheduling\.com/i],
  ["Setmore", /setmore\.com/i],
  ["SimplyBook", /simplybook\.(me|it)/i],
  ["Resy", /resy\.com/i],
  ["Treatwell", /treatwell\./i],
]

const PLATFORMS: Array<[string, RegExp]> = [
  ["Wix", /wix\.com|_wixCssImports|X-Wix-/i],
  ["Squarespace", /squarespace\.com|static1\.squarespace/i],
  ["WordPress", /wp-content|wp-includes|generator" content="WordPress/i],
  ["Shopify", /cdn\.shopify\.com|Shopify\.theme/i],
  ["GoDaddy", /godaddysites\.com|starfieldtech/i],
  ["Weebly", /weebly\.com|weeblycloud/i],
  ["Webflow", /webflow\.(com|io)/i],
]

const SOCIALS: Array<[string, RegExp]> = [
  ["Facebook", /facebook\.com\/[a-z0-9._-]+/i],
  ["Instagram", /instagram\.com\/[a-z0-9._-]+/i],
  ["LinkedIn", /linkedin\.com\/(company|in)\/[a-z0-9._-]+/i],
  ["TikTok", /tiktok\.com\/@[a-z0-9._-]+/i],
  ["YouTube", /youtube\.com\/(channel|c|@)[a-z0-9._/-]+/i],
  ["X", /(twitter|x)\.com\/[a-z0-9._-]+/i],
]

const PARKED_MARKERS = [
  /this domain (is|may be) for sale/i,
  /buy this domain/i,
  /future home of something quite cool/i,
  /website coming soon/i,
  /under construction/i,
  /default web page/i,
  /parked (free )?courtesy of/i,
]

/** Measure a single site. Never throws — failures come back as reachable:false. */
export async function measureSite(rawUrl: string): Promise<SiteMeasurement> {
  const measuredAt = new Date().toISOString()
  const safe = isSafeUrl(rawUrl)
  if (!safe) {
    return { url: rawUrl, reachable: false, error: "Invalid or disallowed URL", measuredAt }
  }

  const started = Date.now()
  let res: Response, finalUrl: URL, hops: URL[]
  try {
    ({ res, finalUrl, hops } = await safeFetch(safe))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      url: rawUrl,
      reachable: false,
      // A timeout is itself a finding — a site too slow to answer in 8s is a
      // real problem for the business, not just a measurement failure.
      error: /timed? ?out|deadline/i.test(msg) ? "Timed out after 8s" : msg,
      measuredAt,
    }
  }

  const responseMs = Date.now() - started
  const status = res.status

  if (status >= 400) {
    await res.body?.cancel()
    return {
      url: rawUrl,
      reachable: false,
      status,
      finalUrl: finalUrl.toString(),
      responseMs,
      error: `Server returned ${status}`,
      measuredAt,
    }
  }

  const html = await readCapped(res).catch(() => "")
  const head = html.slice(0, 120_000) // meta tags live near the top
  const lower = html.toLowerCase()
  const serverHeaders = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n")

  const titleMatch = head.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : ""

  const booking = BOOKING_PROVIDERS.find(([, re]) => re.test(html))
  const platform = PLATFORMS.find(([, re]) => re.test(html) || re.test(serverHeaders))

  const socialLinks = SOCIALS.filter(([, re]) => re.test(html)).map(([name]) => name)

  // Latest 4-digit year appearing near a copyright mark.
  let copyrightYear: number | undefined
  for (const m of html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,24}(19|20)(\d{2})/gi)) {
    const year = Number(`${m[1]}${m[2]}`)
    if (year >= 1990 && year <= new Date().getFullYear() + 1) {
      copyrightYear = Math.max(copyrightYear ?? 0, year)
    }
  }

  return {
    url: rawUrl,
    reachable: true,
    status,
    finalUrl: finalUrl.toString(),
    https: finalUrl.protocol === "https:",
    // Did an http:// start end up on https://? Tells us a redirect exists.
    httpRedirectsToHttps: hops[0].protocol === "http:" && finalUrl.protocol === "https:",
    responseMs,
    htmlBytes: html.length,
    hasViewport: /<meta[^>]+name=["']?viewport/i.test(head),
    title,
    hasMetaDescription: /<meta[^>]+name=["']?description["']?[^>]+content=["'][^"']{20,}/i.test(head),
    hasPhoneLink: /href=["']tel:[+0-9]/i.test(html),
    hasEmailLink: /href=["']mailto:[^"']+@/i.test(html),
    hasContactForm: /<form[\s>]/i.test(html) || /typeform\.com|jotform\.com|google\.com\/forms/i.test(html),
    hasBookingLink: !!booking,
    bookingProvider: booking?.[0],
    hasAnalytics: /gtag\(|googletagmanager\.com|google-analytics\.com|fbq\(|clarity\.ms|plausible\.io/i.test(html),
    hasStructuredData: /application\/ld\+json/i.test(html),
    socialLinks,
    copyrightYear,
    platform: platform?.[0],
    looksParked: html.length < 50_000 && PARKED_MARKERS.some(re => re.test(lower)),
    measuredAt,
  }
}

/** Measure many sites with bounded concurrency. */
export async function measureAll(
  urls: string[],
  concurrency = 6,
): Promise<SiteMeasurement[]> {
  const out: SiteMeasurement[] = new Array(urls.length)
  let cursor = 0

  async function worker() {
    while (true) {
      const i = cursor++
      if (i >= urls.length) return
      out[i] = await measureSite(urls[i])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, urls.length) }, worker),
  )
  return out
}
