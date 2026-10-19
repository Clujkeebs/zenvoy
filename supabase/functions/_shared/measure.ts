// ─── Website measurement ────────────────────────────────────────────────
//
// Fetches a business's website and reports what is actually there. Everything
// in `SiteMeasurement` is observed, never inferred — that's the whole point.
// Scoring and copywriting happen elsewhere; this module only measures.
//
// Runs server-side because a browser can't do it: cross-origin reads are
// blocked, response headers are invisible, and timing is unreliable.

import { classifyFetchError, interpretFetched, nextHop, MAX_HTML_BYTES } from "./interpret.js";

const FETCH_TIMEOUT_MS = 8000
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
  truncated?: boolean
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
        "User-Agent": "ZenvyloBot/1.0 (+https://zenvylo.app/bot; web presence audit)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.get("location")
    if (!isRedirect) return { res, finalUrl: current, hops }

    const hop = nextHop(current.toString(), res.headers.get("location") || "")
    const next = hop.ok ? isSafeUrl(hop.href) : null
    if (!next) throw new Error(hop.ok ? "Redirect to a blocked address" : hop.error)
    await res.body?.cancel()
    current = next
    hops.push(next)
  }
  throw new Error("Too many redirects")
}

/** Read at most MAX_HTML_BYTES of the body so a huge page can't exhaust memory. */
async function readCapped(res: Response): Promise<{ text: string; truncated: boolean }> {
  if (!res.body) return { text: "", truncated: false }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  while (total < MAX_HTML_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    if (total + value.length > MAX_HTML_BYTES) truncated = true
    chunks.push(value)
    total += value.length
    if (truncated) break
  }
  await reader.cancel().catch(() => {})
  const buf = new Uint8Array(Math.min(total, MAX_HTML_BYTES))
  let off = 0
  for (const c of chunks) {
    const take = Math.min(c.length, buf.length - off)
    if (take <= 0) break
    buf.set(c.subarray(0, take), off)
    off += take
  }
  return {
    text: new TextDecoder("utf-8", { fatal: false }).decode(buf.subarray(0, off)),
    truncated,
  }
}

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
    return {
      url: rawUrl,
      reachable: false,
      // A timeout is itself a finding — a site too slow to answer in 8s is a
      // real problem for the business, not just a measurement failure.
      error: classifyFetchError(err instanceof Error ? err.message : String(err)),
      measuredAt,
    }
  }

  const responseMs = Date.now() - started
  const status = res.status
  if (status >= 400) await res.body?.cancel()
  const body = status >= 400
    ? { text: "", truncated: false }
    : await readCapped(res).catch(() => ({ text: "", truncated: false }))

  return interpretFetched({
    rawUrl,
    status,
    finalUrl: finalUrl.toString(),
    hops: hops.map(hop => hop.toString()),
    contentType: res.headers.get("content-type") || "",
    headerText: [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n"),
    html: body.text,
    responseMs,
    measuredAt,
    truncated: body.truncated,
  })
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
