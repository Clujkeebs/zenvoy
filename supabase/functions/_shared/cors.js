/* Normalize browser origins for the function gateway.
 *
 * A configured value like "https://www.zenvylo.app/" must not be echoed back.
 * Browsers compare Access-Control-Allow-Origin to the Origin header exactly,
 * and that header has no trailing slash.
 *
 * The two public hosts come from the site constant, so a secret that lists
 * only one of them still allows the other.
 */

import { SITE_ORIGIN } from '../../../src/constants/site.js'

export function normalizeOrigin(value) {
  return String(value ?? '').trim().replace(/\/+$/, '').toLowerCase()
}

export function siteOrigins(origin = SITE_ORIGIN) {
  const normalized = normalizeOrigin(origin)
  let url
  try { url = new URL(normalized) }
  catch { return normalized ? [normalized] : [] }
  const host = url.hostname.replace(/^www\./, '')
  return [`${url.protocol}//${host}`, `${url.protocol}//www.${host}`]
}

export function allowList(configured) {
  const allowed = new Set(siteOrigins())
  for (const part of String(configured ?? '').split(',')) {
    const origin = normalizeOrigin(part)
    if (origin) allowed.add(origin)
  }
  return allowed
}

/** The header value to send, or '' when the response should not allow this origin. */
export function resolveAllowOrigin(requestOrigin, configured) {
  const raw = String(requestOrigin ?? '').trim()
  const configuredText = String(configured ?? '').trim()
  if (!configuredText) {
    if (raw && allowList('').has(normalizeOrigin(raw))) return raw
    return '*'
  }
  if (raw && allowList(configuredText).has(normalizeOrigin(raw))) return raw
  return ''
}
