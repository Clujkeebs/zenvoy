import { describe, it, expect } from 'vitest'
import { diffMeasurements, applyRescan, unseenChanges } from '../watch'

const base = (over = {}) => ({
  url: 'https://cafe.example',
  reachable: true,
  status: 200,
  https: true,
  responseMs: 400,
  hasViewport: true,
  title: 'Cafe — Coffee in town',
  hasMetaDescription: true,
  hasPhoneLink: true,
  hasEmailLink: true,
  hasContactForm: true,
  hasBookingLink: false,
  hasAnalytics: false,
  hasStructuredData: false,
  socialLinks: [],
  copyrightYear: 2024,
  looksParked: false,
  measuredAt: '2026-09-01T00:00:00.000Z',
  ...over,
})

const lead = (over = {}) => ({
  name: 'Cafe',
  website: 'https://cafe.example',
  phone: '+44 20 0000',
  serviceId: 'web',
  status: 'new',
  siteMeasurement: base(),
  ...over,
})

describe('diffMeasurements', () => {
  it('returns nothing when there is no previous measurement', () => {
    expect(diffMeasurements(null, base())).toEqual([])
  })

  it('returns nothing when the site is unchanged', () => {
    expect(diffMeasurements(base(), base({ measuredAt: '2026-10-01T00:00:00.000Z' }))).toEqual([])
  })

  it('flags a site that stopped loading and stops there', () => {
    const changes = diffMeasurements(base(), base({
      reachable: false, error: 'Timed out after 8s', https: false, hasViewport: false,
    }))
    expect(changes.map(c => c.key)).toEqual(['reachable'])
    expect(changes[0].direction).toBe('broke')
    expect(changes[0].detail).toContain('Timed out after 8s')
  })

  it('cites both speeds when the homepage gets slower', () => {
    const changes = diffMeasurements(base({ responseMs: 500 }), base({ responseMs: 2200 }))
    const speed = changes.find(c => c.key === 'speed')
    expect(speed.direction).toBe('broke')
    expect(speed.detail).toContain('0.5s')
    expect(speed.detail).toContain('2.2s')
  })

  it('notices a booking provider that appeared', () => {
    const changes = diffMeasurements(base(), base({ hasBookingLink: true, bookingProvider: 'Fresha' }))
    const booking = changes.find(c => c.key === 'booking')
    expect(booking.direction).toBe('fixed')
    expect(booking.detail).toContain('Fresha')
  })

  it('ignores a small speed wobble', () => {
    const changes = diffMeasurements(base({ responseMs: 800 }), base({ responseMs: 950 }))
    expect(changes.find(c => c.key === 'speed')).toBeUndefined()
  })
})

describe('applyRescan', () => {
  it('appends a watch entry only when something changed', () => {
    const same = applyRescan(lead(), base({ measuredAt: '2026-10-02T00:00:00.000Z' }))
    expect(same.watchLog || []).toEqual([])

    const next = applyRescan(lead(), base({
      measuredAt: '2026-10-02T00:00:00.000Z',
      https: false,
    }))
    expect(next.watchLog).toHaveLength(1)
    expect(next.watchLog[0].changes[0].key).toBe('https')
    expect(next.ssl).toBe(false)
    expect(next.findings.some(f => f.id === 'no_https')).toBe(true)
    expect(next.score).toBeGreaterThan(10)
  })

  it('does not treat the first measurement as a change', () => {
    const next = applyRescan(lead({ siteMeasurement: null }), base({ https: false }))
    expect(next.watchLog).toEqual([])
    expect(next.findings.some(f => f.id === 'no_https')).toBe(true)
  })
})

describe('unseenChanges', () => {
  it('hides entries the user has already seen', () => {
    const watched = lead({
      watchLog: [{ at: '2026-10-01T00:00:00.000Z', changes: [{ key: 'https', label: 'HTTPS lost', detail: 'x', direction: 'broke' }] }],
      watchSeenAt: '2026-10-02T00:00:00.000Z',
    })
    expect(unseenChanges([watched])).toEqual([])
  })

  it('surfaces a change newer than the last time you looked', () => {
    const watched = lead({
      name: 'Cafe',
      watchSeenAt: '2026-10-01T00:00:00.000Z',
      watchLog: [{ at: '2026-10-03T00:00:00.000Z', changes: [{ key: 'booking', label: 'Online booking added', detail: 'Fresha', direction: 'fixed' }] }],
    })
    const items = unseenChanges([watched])
    expect(items).toHaveLength(1)
    expect(items[0].changes[0].key).toBe('booking')
  })
})
