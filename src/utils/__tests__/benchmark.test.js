import { describe, it, expect } from 'vitest'
import { compareToPeers, benchmarkEvidence, benchmarkSummary } from '../benchmark'

/* These claims end up in an email to a real business owner who can check them,
 * so the maths has to be conservative: never "most of them" off two data
 * points, never a comparison we didn't measure.
 */

const site = (over = {}) => ({
  reachable: true, https: true, hasViewport: true, hasBookingLink: true,
  hasPhoneLink: true, hasMetaDescription: true, responseMs: 500, ...over,
})

const peer = (over = {}, dist = 100) => ({
  name: 'Peer', distanceM: dist, hasWebsite: true, measurement: site(over),
})

const bench = (peers, radiusM = 2500) => ({ peers, radiusM, measuredAt: new Date().toISOString() })

describe('compareToPeers', () => {
  it('refuses to compare against fewer than three neighbours', () => {
    const c = compareToPeers(site(), bench([peer(), peer()]))
    expect(c.ready).toBe(false)
    expect(c.headlines).toEqual([])
  })

  it('handles a missing benchmark without throwing', () => {
    expect(compareToPeers(site(), null).ready).toBe(false)
    expect(compareToPeers(null, undefined).ready).toBe(false)
  })

  it('names the gap when the neighbours are ahead', () => {
    const c = compareToPeers(
      site({ https: false }),
      bench([peer(), peer(), peer(), peer()]),
    )
    expect(c.ready).toBe(true)
    expect(c.headlines[0]).toMatch(/4 of the 4 nearest .* have a secure \(HTTPS\) site/)
    expect(c.behindOn.map(s => s.key)).toContain('https')
  })

  it('says nothing when the prospect is keeping up', () => {
    const c = compareToPeers(site(), bench([peer(), peer(), peer()]))
    expect(c.ready).toBe(true)
    expect(c.headlines).toEqual([])
    expect(c.behindOn).toEqual([])
  })

  it('counts a website-less neighbour against the trait, not out of the sample', () => {
    // Two of three have HTTPS — the third has no site at all.
    const c = compareToPeers(site({ https: false }), bench([
      peer(), peer(), { name: 'No site', distanceM: 50, hasWebsite: false, measurement: null },
    ]))
    const https = c.stats.find(s => s.key === 'https')
    expect(https.peersWith).toBe(2)
    expect(https.peersTotal).toBe(3)
    expect(https.pct).toBe(67)
  })

  it('does not claim a majority off a single neighbour', () => {
    // Only one of four has booking — not a fair "everyone has this" claim.
    const c = compareToPeers(site({ hasBookingLink: false }), bench([
      peer(), peer({ hasBookingLink: false }), peer({ hasBookingLink: false }),
      peer({ hasBookingLink: false }),
    ]))
    expect(c.behindOn.map(s => s.key)).not.toContain('booking')
  })

  it('ignores neighbours whose site could not be reached', () => {
    const c = compareToPeers(site({ https: false }), bench([
      peer(), peer(),
      { name: 'Dead', distanceM: 80, hasWebsite: true, measurement: { reachable: false } },
    ]))
    const https = c.stats.find(s => s.key === 'https')
    expect(https.peersWith).toBe(2)
    expect(https.peersTotal).toBe(3)
  })

  it('computes the median response time of live neighbours', () => {
    const c = compareToPeers(site(), bench([
      peer({ responseMs: 200 }), peer({ responseMs: 400 }), peer({ responseMs: 900 }),
    ]))
    expect(c.medianResponseMs).toBe(400)
  })

  it('calls out being markedly slower than the local median', () => {
    const c = compareToPeers(site({ responseMs: 5000 }), bench([
      peer({ responseMs: 400 }), peer({ responseMs: 500 }), peer({ responseMs: 600 }),
    ]))
    expect(c.headlines.some(h => /5\.0s/.test(h) && /median is 0\.5s/.test(h))).toBe(true)
  })

  it('does not nitpick a small speed difference', () => {
    const c = compareToPeers(site({ responseMs: 900 }), bench([
      peer({ responseMs: 700 }), peer({ responseMs: 800 }), peer({ responseMs: 900 }),
    ]))
    expect(c.headlines.some(h => /median/.test(h))).toBe(false)
  })

  it('reports the search radius in kilometres', () => {
    const c = compareToPeers(site(), bench([peer(), peer(), peer()], 8000))
    expect(c.radiusKm).toBe(8)
  })

  it('caps the headline list so an email stays readable', () => {
    const broken = site({
      https: false, hasViewport: false, hasBookingLink: false,
      hasPhoneLink: false, hasMetaDescription: false,
    })
    const c = compareToPeers(broken, bench([peer(), peer(), peer(), peer()]))
    // Five traits are behind, but only the strongest three are worth saying.
    expect(c.behindOn.length).toBe(5)
    expect(c.headlines.length).toBeLessThanOrEqual(4)
  })
})

describe('benchmarkEvidence', () => {
  it('produces citable evidence entries for the prompt layer', () => {
    const c = compareToPeers(site({ https: false }), bench([peer(), peer(), peer()]))
    const ev = benchmarkEvidence(c)
    expect(ev.length).toBeGreaterThan(0)
    expect(ev[0]).toHaveProperty('evidence')
    expect(ev[0].label).toBe('Behind local competitors')
  })

  it('produces nothing when there is no fair comparison', () => {
    expect(benchmarkEvidence(compareToPeers(site(), bench([peer()])))).toEqual([])
  })
})

describe('benchmarkSummary', () => {
  it('summarises the strongest gap', () => {
    const c = compareToPeers(site({ https: false }), bench([peer(), peer(), peer()]))
    expect(benchmarkSummary(c)).toMatch(/Behind 3\/3 neighbours/)
  })

  it('is positive when there is no gap', () => {
    const c = compareToPeers(site(), bench([peer(), peer(), peer()]))
    expect(benchmarkSummary(c)).toMatch(/Keeping up/)
  })

  it('returns null when not ready', () => {
    expect(benchmarkSummary({ ready: false })).toBeNull()
  })
})
