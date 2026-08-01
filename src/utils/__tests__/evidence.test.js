import { describe, it, expect } from 'vitest'
import {
  deriveFindings, scoreFindings, opportunityLabel, summarize, relevanceFor,
} from '../evidence'

/* The scoring engine is the product's core claim: "these issues are real and
 * this number means something". These tests exist so that claim keeps holding.
 */

const business = (over = {}) => ({
  name: 'Test Cafe',
  btype: 'Café',
  website: 'https://testcafe.com',
  phone: '+44 20 1234 5678',
  ...over,
})

/** A site with nothing wrong with it. */
const healthySite = (over = {}) => ({
  url: 'https://testcafe.com',
  reachable: true,
  status: 200,
  https: true,
  responseMs: 300,
  htmlBytes: 40_000,
  hasViewport: true,
  title: 'Test Cafe — Speciality Coffee in Shoreditch',
  hasMetaDescription: true,
  hasPhoneLink: true,
  hasEmailLink: true,
  hasContactForm: true,
  hasBookingLink: true,
  hasAnalytics: true,
  hasStructuredData: true,
  socialLinks: ['Instagram'],
  copyrightYear: new Date().getFullYear(),
  looksParked: false,
  measuredAt: new Date().toISOString(),
  ...over,
})

describe('deriveFindings', () => {
  it('flags a missing website as the strongest single finding', () => {
    const f = deriveFindings(business({ website: null }), null)
    const noSite = f.find(x => x.id === 'no_website')
    expect(noSite).toBeDefined()
    expect(noSite.category).toBe('presence')
    expect(Math.max(...f.map(x => x.weight))).toBe(noSite.weight)
  })

  it('finds nothing wrong with a healthy site', () => {
    expect(deriveFindings(business(), healthySite())).toEqual([])
  })

  it('quotes the measurement in the evidence string', () => {
    const f = deriveFindings(business(), healthySite({ responseMs: 6200 }))
    const slow = f.find(x => x.id === 'very_slow')
    // The evidence has to be checkable by the person receiving the pitch.
    expect(slow.evidence).toContain('6.2s')
  })

  it('reports an unreachable site and stops there', () => {
    const f = deriveFindings(business(), {
      url: 'https://testcafe.com', reachable: false,
      error: 'Timed out after 8s', measuredAt: new Date().toISOString(),
    })
    expect(f.some(x => x.id === 'site_unreachable')).toBe(true)
    // No point reporting "no meta description" on a site that never loaded.
    expect(f.some(x => x.id === 'no_meta_description')).toBe(false)
  })

  it('does not invent findings when a measurement is absent', () => {
    // No measurement at all — only the OSM-derived facts should appear.
    const f = deriveFindings(business({ phone: null }), null)
    expect(f.map(x => x.id)).toEqual(['no_listed_phone'])
  })

  it('treats a stale copyright as a sign of neglect', () => {
    const year = new Date().getFullYear() - 4
    const f = deriveFindings(business(), healthySite({ copyrightYear: year }))
    const stale = f.find(x => x.id === 'stale_copyright')
    expect(stale.evidence).toContain(String(year))
    expect(stale.evidence).toContain('4 years')
  })

  it('does not flag last year as stale', () => {
    const f = deriveFindings(business(), healthySite({ copyrightYear: new Date().getFullYear() - 1 }))
    expect(f.some(x => x.id === 'stale_copyright')).toBe(false)
  })
})

describe('scoreFindings', () => {
  it('is deterministic — the same input always scores the same', () => {
    const f = deriveFindings(business({ website: null, phone: null }), null)
    const a = scoreFindings(f, 'web')
    const b = scoreFindings(f, 'web')
    expect(a.score).toBe(b.score)
  })

  it('scores a business with no website highly for a web designer', () => {
    const f = deriveFindings(business({ website: null }), null)
    expect(scoreFindings(f, 'web').score).toBeGreaterThanOrEqual(60)
  })

  it('scores the same business low for a service the finding does not touch', () => {
    const f = deriveFindings(business(), healthySite({ hasBookingLink: false }))
    // A missing booking link matters to automation, not to branding.
    expect(scoreFindings(f, 'crm').score).toBeGreaterThan(scoreFindings(f, 'brand').score)
  })

  it('gives a healthy site the floor score and no findings', () => {
    const f = deriveFindings(business(), healthySite())
    const { score, findings } = scoreFindings(f, 'web')
    expect(findings).toHaveLength(0)
    expect(score).toBe(10)
  })

  it('never exceeds 98 no matter how broken the site is', () => {
    const f = deriveFindings(business({ website: 'http://x.com', phone: null }), {
      url: 'http://x.com', reachable: true, status: 200, https: false,
      responseMs: 9000, htmlBytes: 900_000, hasViewport: false, title: '',
      hasMetaDescription: false, hasPhoneLink: false, hasEmailLink: false,
      hasContactForm: false, hasBookingLink: false, hasAnalytics: false,
      hasStructuredData: false, socialLinks: [], copyrightYear: 2009,
      platform: 'Wix', looksParked: true, measuredAt: new Date().toISOString(),
    })
    expect(scoreFindings(f, 'web').score).toBeLessThanOrEqual(98)
  })

  it('orders findings by how much they matter to the chosen service', () => {
    const f = deriveFindings(business(), healthySite({
      https: false, hasViewport: false, hasAnalytics: false,
    }))
    const { findings } = scoreFindings(f, 'web')
    const weights = findings.map(x => x.effectiveWeight)
    expect(weights).toEqual([...weights].sort((a, b) => b - a))
  })

  it('drops findings that are irrelevant to the service', () => {
    const f = deriveFindings(business(), healthySite({ hasBookingLink: false }))
    const { findings } = scoreFindings(f, 'brand')
    expect(findings.some(x => x.id === 'no_booking')).toBe(false)
  })

  it('handles a typed custom service by weighting everything moderately', () => {
    const f = deriveFindings(business(), healthySite({ https: false, hasViewport: false }))
    const custom = scoreFindings(f, 'custom')
    // Something to work with, but not the tuned score a preset would give.
    expect(custom.findings.length).toBeGreaterThan(0)
    expect(custom.score).toBeLessThan(scoreFindings(f, 'web').score)
  })
})

describe('relevanceFor', () => {
  it('falls back to the custom weighting for an unknown service id', () => {
    const r = relevanceFor('something-nobody-listed')
    expect(Object.values(r).every(v => v > 0)).toBe(true)
  })
})

describe('opportunityLabel', () => {
  it('says so plainly when nothing was found', () => {
    expect(opportunityLabel(10, 0).label).toBe('No issues found')
  })

  it('distinguishes strong leads from weak ones', () => {
    expect(opportunityLabel(80, 5).label).toBe('Strong lead')
    expect(opportunityLabel(35, 2).label).toBe('Weak lead')
  })
})

describe('summarize', () => {
  it('counts the issues and names the top ones', () => {
    const f = deriveFindings(business({ website: null, phone: null }), null)
    // 'local' cares about both presence and contact, so both findings survive.
    const { findings } = scoreFindings(f, 'local')
    expect(summarize(findings)).toMatch(/^2 verified issues · /)
  })

  it('only counts findings relevant to the service', () => {
    const f = deriveFindings(business({ website: null, phone: null }), null)
    // A web designer doesn't care that the phone number is missing.
    const { findings } = scoreFindings(f, 'web')
    expect(summarize(findings)).toBe('1 verified issue · no website')
  })

  it('is honest about an empty list', () => {
    expect(summarize([])).toBe('No measurable issues found')
  })
})
