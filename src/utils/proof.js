/* ── proof.js — a shareable, checkable mini audit ───────────────────────
 *
 * The page is the payload. The link contains the measurements, and the
 * verification code is a hash of those measurements. If anyone edits the
 * link, the code no longer matches. A business owner can open it with no
 * account and see exactly what was observed — not a sales paragraph.
 * ─────────────────────────────────────────────────────────────────────── */

import { compareToPeers } from './benchmark'

const PROOF_VERSION = 1

/** Stable JSON so the hash does not depend on key order. */
export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort()
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}'
}

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export function formatCode(hex) {
  const h = String(hex || '').slice(0, 12).toUpperCase()
  return h.replace(/(.{4})(?=.)/g, '$1-')
}

function pickMeasurement(m) {
  if (!m) return null
  return {
    url: m.finalUrl || m.url || '',
    reachable: !!m.reachable,
    error: m.error || null,
    status: m.status ?? null,
    https: m.https ?? null,
    responseMs: typeof m.responseMs === 'number' ? Math.round(m.responseMs) : null,
    htmlBytes: typeof m.htmlBytes === 'number' ? m.htmlBytes : null,
    hasViewport: m.hasViewport ?? null,
    title: m.title || '',
    hasMetaDescription: m.hasMetaDescription ?? null,
    hasPhoneLink: m.hasPhoneLink ?? null,
    hasEmailLink: m.hasEmailLink ?? null,
    hasContactForm: m.hasContactForm ?? null,
    hasBookingLink: m.hasBookingLink ?? null,
    bookingProvider: m.bookingProvider || null,
    hasAnalytics: m.hasAnalytics ?? null,
    hasStructuredData: m.hasStructuredData ?? null,
    socialLinks: Array.isArray(m.socialLinks) ? m.socialLinks.slice(0, 8) : [],
    copyrightYear: m.copyrightYear ?? null,
    platform: m.platform || null,
    looksParked: m.looksParked ?? null,
    measuredAt: m.measuredAt || null,
  }
}

/**
 * Build the public document for one lead.
 * AI copy and suggested prices stay off this page on purpose.
 */
export function buildProofDocument(lead, preparer = '') {
  const m = pickMeasurement(lead?.siteMeasurement)
  const comparison = compareToPeers(lead?.siteMeasurement, lead?.benchmark)
  return {
    v: PROOF_VERSION,
    name: lead?.name || 'Untitled business',
    btype: lead?.btype || '',
    city: lead?.city || '',
    country: lead?.country || '',
    website: lead?.website || '',
    measuredAt: lead?.auditedAt || m?.measuredAt || null,
    preparer: preparer || '',
    score: Number.isFinite(lead?.score) ? lead.score : null,
    findings: (lead?.findings || []).slice(0, 12).map(f => ({
      id: f.id,
      label: f.label,
      evidence: f.evidence,
      weight: f.weight,
    })),
    measurement: m,
    peerHeadlines: comparison.ready ? comparison.headlines.slice(0, 3) : [],
    peerSample: comparison.ready ? comparison.sampleSize : 0,
    ...(lead?.sample ? { sample: true } : {}),
  }
}

export async function signProof(doc) {
  const { code: _ignored, ...body } = doc
  const hex = await sha256Hex(canonical(body))
  return { ...body, code: formatCode(hex), hash: hex }
}

/** Encode a signed proof into a URL-safe string. */
export function encodeProof(signed) {
  const json = JSON.stringify(signed)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeProof(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    const bin = atob(b64 + pad)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    const doc = JSON.parse(json)
    if (!doc || typeof doc !== 'object' || doc.v !== PROOF_VERSION) return null
    return doc
  } catch {
    return null
  }
}

/** Recompute the hash and say whether the document still matches its code. */
export async function verifyProof(doc) {
  if (!doc?.code || !doc?.hash) return { ok: false, reason: 'missing' }
  const { code, hash, ...body } = doc
  const hex = await sha256Hex(canonical(body))
  const ok = hex === hash && formatCode(hex) === code
  return { ok, reason: ok ? 'match' : 'altered' }
}

export async function proofLink(lead, preparer, origin = 'https://zenvylo.app') {
  const signed = await signProof(buildProofDocument(lead, preparer))
  const token = encodeProof(signed)
  const base = String(origin || '').replace(/\/$/, '')
  return { url: `${base}/proof#${token}`, code: signed.code, token, signed }
}
