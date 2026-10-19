/* ── safeUrl.js — reject fetches that are not a public website ────────────
 *
 * An authenticated caller could otherwise point the measurer at the cloud
 * network or at this project's own services. Literal private addresses and
 * local names are refused. A hostile DNS name that later resolves to a
 * private address still needs to be blocked at the network, not here.
 * ─────────────────────────────────────────────────────────────────────── */

const BLOCKED_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /\.internal$/i,
  /^0\./,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^metadata\./i,
]

function mappedIpv4(host) {
  const mark = ':ffff:'
  const at = host.lastIndexOf(mark)
  if (at === -1) return ''
  const tail = host.slice(at + mark.length)
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(tail)) return tail
  const parts = tail.split(':')
  if (parts.length !== 2 || parts.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return ''
  const n = (parseInt(parts[0], 16) << 16) + parseInt(parts[1], 16)
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.')
}

function isBlockedName(host) {
  const h = String(host || '').replace(/^\[|\]$/g, '').toLowerCase()
  if (!h) return true
  if (BLOCKED_HOST_PATTERNS.some(re => re.test(h))) return true
  const mapped = mappedIpv4(h)
  if (mapped) return isBlockedName(mapped)
  if (!h.includes(':')) return false
  if (h === '::' || h === '::1' || h.startsWith('fe80:')) return true
  if (/^f[cd][0-9a-f]{0,2}:/.test(h)) return true
  return false
}

/** @returns {URL | null} */
export function isSafeUrl(raw) {
  let u
  try { u = new URL(raw) }
  catch { return null }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.username || u.password) return null
  const host = u.hostname
  if (!host || (!host.includes('.') && !host.startsWith('['))) return null
  if (isBlockedName(host)) return null
  return u
}
