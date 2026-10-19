/* ── interpret.js — turn a fetch into a measurement ───────────────────────
 *
 * The network call lives in measure.ts. This file only classifies what came
 * back, so the awkward cases can be tested with saved responses: a timeout
 * message, a redirect hop, a bot wall, a PDF, and a page cut off at the cap.
 * ─────────────────────────────────────────────────────────────────────── */

export const MAX_HTML_BYTES = 400_000

const BOOKING_PROVIDERS = [
  ['Calendly', /calendly\.com/i],
  ['Booksy', /booksy\.com/i],
  ['Fresha', /fresha\.com/i],
  ['Square', /squareup\.com|square\.site/i],
  ['OpenTable', /opentable\./i],
  ['Acuity', /acuityscheduling\.com/i],
  ['Setmore', /setmore\.com/i],
  ['SimplyBook', /simplybook\.(me|it)/i],
  ['Resy', /resy\.com/i],
  ['Treatwell', /treatwell\./i],
]

const PLATFORMS = [
  ['Wix', /wix\.com|_wixCssImports|X-Wix-/i],
  ['Squarespace', /squarespace\.com|static1\.squarespace/i],
  ['WordPress', /wp-content|wp-includes|generator" content="WordPress/i],
  ['Shopify', /cdn\.shopify\.com|Shopify\.theme/i],
  ['GoDaddy', /godaddysites\.com|starfieldtech/i],
  ['Weebly', /weebly\.com|weeblycloud/i],
  ['Webflow', /webflow\.(com|io)/i],
]

const SOCIALS = [
  ['Facebook', /facebook\.com\/[a-z0-9._-]+/i],
  ['Instagram', /instagram\.com\/[a-z0-9._-]+/i],
  ['LinkedIn', /linkedin\.com\/(company|in)\/[a-z0-9._-]+/i],
  ['TikTok', /tiktok\.com\/@[a-z0-9._-]+/i],
  ['YouTube', /youtube\.com\/(channel|c|@)[a-z0-9._/-]+/i],
  ['X', /(twitter|x)\.com\/[a-z0-9._-]+/i],
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

const BOT_WALL = [
  /cf-browser-verification/i,
  /just a moment\.\.\./i,
  /attention required! \| cloudflare/i,
  /enable javascript and cookies to continue/i,
  /<title>\s*access denied\s*<\/title>/i,
]

export function classifyFetchError(message) {
  const msg = String(message || '')
  if (/timed? ?out|deadline|aborted/i.test(msg)) return 'Timed out after 8s'
  if (/too many redirects/i.test(msg)) return 'Too many redirects'
  if (/blocked address/i.test(msg)) return 'Redirect to a blocked address'
  return msg || 'The site could not be fetched'
}

export function nextHop(currentHref, location) {
  if (!location) return { ok: false, error: 'Redirect had no destination' }
  let next
  try { next = new URL(location, currentHref) }
  catch { return { ok: false, error: 'Redirect was not a valid URL' } }
  if (next.protocol !== 'http:' && next.protocol !== 'https:') {
    return { ok: false, error: 'Redirect to a blocked address' }
  }
  return { ok: true, href: next.toString() }
}

export function isHtmlResponse(contentType, html) {
  const ct = String(contentType || '').toLowerCase()
  if (ct.includes('text/html') || ct.includes('application/xhtml')) return true
  if (ct.includes('pdf') || ct.startsWith('image/') || ct.includes('json') || ct.includes('octet-stream') || ct.includes('zip')) {
    return false
  }
  return /^\s*</.test(String(html || '').slice(0, 400))
}

export function looksLikeBotWall(html) {
  return BOT_WALL.some(re => re.test(String(html || '').slice(0, 12_000)))
}

function statusError(status) {
  if (status === 401 || status === 403) return `The site refused the check (${status}). The page itself was not measured.`
  if (status === 429) return 'The site rate-limited the check (429). The page itself was not measured.'
  if (status >= 400) return `Server returned ${status}`
  return ''
}

/**
 * @param {object} input
 * @returns {object} measurement fields. Failures set reachable false and do
 * not invent viewport, booking, or title from a challenge page or a PDF.
 */
export function interpretFetched(input) {
  const measuredAt = input.measuredAt || new Date().toISOString()
  const base = {
    url: input.rawUrl,
    measuredAt,
    responseMs: input.responseMs,
    status: input.status,
    finalUrl: input.finalUrl,
  }
  const status = Number(input.status || 0)
  if (status >= 400) {
    return { ...base, reachable: false, error: statusError(status) }
  }

  const html = String(input.html || '')
  const contentType = input.contentType || ''
  if (!isHtmlResponse(contentType, html)) {
    const kind = contentType ? contentType.split(';')[0].trim() : 'an empty or unknown body'
    return {
      ...base,
      reachable: false,
      error: `Response was not a web page (${kind}).`,
    }
  }

  if (looksLikeBotWall(html)) {
    return {
      ...base,
      reachable: false,
      error: 'The site returned a bot check instead of the page. Nothing on the page was measured.',
    }
  }

  const head = html.slice(0, 120_000)
  const lower = html.toLowerCase()
  const serverHeaders = input.headerText || ''
  const titleMatch = head.match(/<title[^>]*>([\s\S]{0,300}?)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/\s+/g, ' ').trim() : ''
  const booking = BOOKING_PROVIDERS.find(([, re]) => re.test(html))
  const platform = PLATFORMS.find(([, re]) => re.test(html) || re.test(serverHeaders))
  const socialLinks = SOCIALS.filter(([, re]) => re.test(html)).map(([name]) => name)

  let copyrightYear
  for (const match of html.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,24}(19|20)(\d{2})/gi)) {
    const year = Number(`${match[1]}${match[2]}`)
    if (year >= 1990 && year <= new Date().getFullYear() + 1) {
      copyrightYear = Math.max(copyrightYear ?? 0, year)
    }
  }

  const hops = input.hops || []
  const truncated = !!input.truncated
  return {
    ...base,
    reachable: true,
    https: String(input.finalUrl || '').startsWith('https:'),
    httpRedirectsToHttps: String(hops[0] || '').startsWith('http:') && String(input.finalUrl || '').startsWith('https:'),
    htmlBytes: html.length,
    truncated,
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
  }
}
