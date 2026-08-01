import { describe, it, expect } from 'vitest'
import {
  trialEndMs, isTrialActive, isTrialExpired, getTrialDaysLeft, checkTrialExpiry,
} from '../trial'

/* These exist because of a real bug: trialEnd arrives from Postgres as an ISO
 * string, and the old code compared it to Date.now() with `<`. Number-vs-string
 * coerces to NaN, so isTrialActive was permanently false — the trial banner
 * never showed and expired trials were never downgraded. Every case below would
 * have caught it.
 */

const NOW = Date.parse('2026-07-30T12:00:00Z')
const inDays = n => new Date(NOW + n * 86400000).toISOString()

describe('trialEndMs', () => {
  it('parses an ISO string, which is what Supabase returns', () => {
    expect(trialEndMs({ trialEnd: '2026-08-05T12:00:00Z' }))
      .toBe(Date.parse('2026-08-05T12:00:00Z'))
  })

  it('still accepts a raw epoch number from older records', () => {
    expect(trialEndMs({ trialEnd: NOW })).toBe(NOW)
  })

  it('accepts a Date', () => {
    expect(trialEndMs({ trialEnd: new Date(NOW) })).toBe(NOW)
  })

  it('returns null rather than NaN for missing or junk values', () => {
    expect(trialEndMs({})).toBeNull()
    expect(trialEndMs({ trialEnd: null })).toBeNull()
    expect(trialEndMs({ trialEnd: '' })).toBeNull()
    expect(trialEndMs({ trialEnd: 'not a date' })).toBeNull()
    expect(trialEndMs(null)).toBeNull()
  })
})

describe('isTrialActive', () => {
  it('is true for an ISO-string trial that has not ended', () => {
    expect(isTrialActive({ trialEnd: inDays(3) }, NOW)).toBe(true)
  })

  it('is false once the end has passed', () => {
    expect(isTrialActive({ trialEnd: inDays(-1) }, NOW)).toBe(false)
  })

  it('is false when there is no trial at all', () => {
    expect(isTrialActive({ plan: 'free' }, NOW)).toBe(false)
  })
})

describe('getTrialDaysLeft', () => {
  it('rounds up, so a part-day still reads as a day', () => {
    expect(getTrialDaysLeft({ trialEnd: new Date(NOW + 1.2 * 86400000).toISOString() }, NOW)).toBe(2)
  })

  it('is 0 for an expired trial rather than negative', () => {
    expect(getTrialDaysLeft({ trialEnd: inDays(-5) }, NOW)).toBe(0)
  })

  it('reports 7 days at the start of a fresh trial', () => {
    expect(getTrialDaysLeft({ trialEnd: inDays(7) }, NOW)).toBe(7)
  })
})

describe('isTrialExpired', () => {
  it('does not treat "never had a trial" as expired', () => {
    expect(isTrialExpired({ plan: 'free' }, NOW)).toBe(false)
  })

  it('is true after the end date', () => {
    expect(isTrialExpired({ trialEnd: inDays(-1) }, NOW)).toBe(true)
  })
})

describe('checkTrialExpiry', () => {
  it('downgrades a lapsed trial for display', () => {
    const u = checkTrialExpiry({ plan: 'pro', trialEnd: inDays(-1) }, NOW)
    expect(u.plan).toBe('free')
  })

  it('leaves an active trial alone', () => {
    const u = checkTrialExpiry({ plan: 'pro', trialEnd: inDays(2) }, NOW)
    expect(u.plan).toBe('pro')
  })

  it('does not downgrade a real paying subscriber whose trial converted', () => {
    const u = checkTrialExpiry(
      { plan: 'pro', trialEnd: inDays(-1), stripeSubscriptionId: 'sub_123' }, NOW)
    expect(u.plan).toBe('pro')
  })

  it('leaves a user with no trial untouched', () => {
    const input = { plan: 'growth' }
    expect(checkTrialExpiry(input, NOW)).toBe(input)
  })
})
