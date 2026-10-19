import { describe, it, expect } from 'vitest'
import {
  canonical, signProof, decodeProof, verifyProof, buildProofDocument, proofLink,
} from '../proof'

const lead = {
  name: 'North Cafe',
  btype: 'Café',
  city: 'Leeds',
  country: 'United Kingdom',
  website: 'http://northcafe.example',
  score: 71,
  auditedAt: '2026-10-01T12:00:00.000Z',
  why: 'This sentence is written by a model and must not appear on the proof page.',
  suggestedMonthlyRate: 900,
  findings: [
    { id: 'no_https', label: 'No HTTPS', evidence: 'northcafe.example serves over plain http.', weight: 24, category: 'security' },
  ],
  siteMeasurement: {
    url: 'http://northcafe.example',
    finalUrl: 'http://northcafe.example/',
    reachable: true,
    status: 200,
    https: false,
    responseMs: 1800.4,
    hasViewport: true,
    title: 'North Cafe',
    hasMetaDescription: false,
    hasPhoneLink: false,
    hasEmailLink: false,
    hasContactForm: false,
    hasBookingLink: false,
    hasAnalytics: false,
    hasStructuredData: false,
    socialLinks: [],
    measuredAt: '2026-10-01T12:00:00.000Z',
  },
}

describe('proof documents', () => {
  it('keeps model copy and prices off the public document', () => {
    const doc = buildProofDocument(lead, 'Alex')
    const blob = JSON.stringify(doc)
    expect(blob).not.toContain('must not appear')
    expect(blob).not.toContain('900')
    expect(doc.findings[0].evidence).toContain('plain http')
    expect(doc.measurement.https).toBe(false)
    expect(doc.measurement.responseMs).toBe(1800)
  })

  it('hashes the same document to the same code regardless of key order', async () => {
    const a = await signProof({ name: 'A', v: 1, n: 2 })
    const b = await signProof({ n: 2, v: 1, name: 'A' })
    expect(a.code).toBe(b.code)
    expect(a.hash).toBe(b.hash)
    expect(canonical({ b: 1, a: 2 })).toBe(canonical({ a: 2, b: 1 }))
  })

  it('round-trips through a URL and notices tampering', async () => {
    const { url, token, code } = await proofLink(lead, 'Alex', 'https://zenvylo.app')
    expect(url.startsWith('https://zenvylo.app/proof#')).toBe(true)
    const decoded = decodeProof(token)
    expect(decoded.name).toBe('North Cafe')
    expect(decoded.code).toBe(code)
    expect((await verifyProof(decoded)).ok).toBe(true)

    const tampered = { ...decoded, findings: [{ ...decoded.findings[0], evidence: 'Invented traffic of 10,000 visits.' }] }
    expect((await verifyProof(tampered)).ok).toBe(false)
  })

  it('rejects a token that is not a proof', () => {
    expect(decodeProof('not-a-proof')).toBeNull()
    expect(decodeProof('')).toBeNull()
  })

  it('adds an owner id only when one is passed, and that changes the hash', async () => {
    const plain = buildProofDocument(lead, 'Alex')
    const owned = buildProofDocument(lead, 'Alex', { ownerId: '11111111-1111-4111-8111-111111111111' })
    expect(plain.ownerId).toBeUndefined()
    expect(owned.ownerId).toBe('11111111-1111-4111-8111-111111111111')
    expect(owned.measurement.truncated).toBe(false)
    const a = await signProof(plain)
    const b = await signProof(owned)
    expect(a.hash).not.toBe(b.hash)
  })
})
