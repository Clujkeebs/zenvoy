import { describe, it, expect } from 'vitest'
import {
  currentStep, nextStep, nextDueDate, recordTouch, undoTouch,
  outreachSummary, closeDeal, MAX_STEP, SEQUENCE,
} from '../outreach'

const NOW = Date.parse('2026-08-01T12:00:00Z')
const daysAgo = n => new Date(NOW - n * 86400000).toISOString()

const lead = (over = {}) => ({ id: 'l1', status: 'new', outreachStep: 0, ...over })

describe('currentStep', () => {
  it('treats a fresh lead as never contacted', () => {
    expect(currentStep(lead())).toBe(0)
    expect(currentStep({})).toBe(0)
    expect(currentStep(null)).toBe(0)
  })

  it('clamps nonsense values into range', () => {
    expect(currentStep(lead({ outreachStep: 999 }))).toBe(MAX_STEP)
    expect(currentStep(lead({ outreachStep: -5 }))).toBe(0)
  })
})

describe('recordTouch', () => {
  it('starts the sequence and schedules the next touch in one action', () => {
    const patch = recordTouch(lead(), { now: NOW })
    expect(patch.outreachStep).toBe(1)
    expect(patch.status).toBe('contacted')
    expect(patch.contactedAt).toBe(new Date(NOW).toISOString())
    // Step 2 is 2 days after first contact.
    expect(patch.followUpDate).toBe('2026-08-03')
  })

  it('does not clobber a status you set by hand', () => {
    const patch = recordTouch(lead({ status: 'negotiating' }), { now: NOW })
    expect(patch.status).toBe('negotiating')
  })

  it('keeps the original contact date so the sequence keeps its shape', () => {
    const started = daysAgo(10)
    const patch = recordTouch(lead({ outreachStep: 1, contactedAt: started }), { now: NOW })
    expect(patch.contactedAt).toBe(started)
    // Step 3 sits 5 days after the *first* touch, which is already past.
    expect(patch.followUpDate).toBe('2026-07-27')
  })

  it('appends to the log without unbounded growth', () => {
    let l = lead()
    for (let i = 0; i < 30; i++) l = { ...l, ...recordTouch(l, { now: NOW }) }
    expect(l.outreachLog.length).toBeLessThanOrEqual(20)
  })

  it('stops advancing at the end of the sequence', () => {
    const patch = recordTouch(lead({ outreachStep: MAX_STEP }), { now: NOW })
    expect(patch.outreachStep).toBe(MAX_STEP)
  })

  it('records what kind of touch it was', () => {
    const patch = recordTouch(lead(), { kind: 'call', now: NOW })
    expect(patch.outreachLog[0].kind).toBe('call')
  })
})

describe('undoTouch', () => {
  it('returns null when there is nothing to undo', () => {
    expect(undoTouch(lead())).toBeNull()
  })

  it('rolls a first touch all the way back to new', () => {
    const touched = { ...lead(), ...recordTouch(lead(), { now: NOW }) }
    const patch = undoTouch(touched)
    expect(patch.outreachStep).toBe(0)
    expect(patch.status).toBe('new')
    expect(patch.contactedAt).toBeNull()
    expect(patch.followUpDate).toBeNull()
  })

  it('steps back one touch without resetting the sequence', () => {
    let l = lead()
    l = { ...l, ...recordTouch(l, { now: NOW }) }
    l = { ...l, ...recordTouch(l, { now: NOW }) }
    const patch = undoTouch(l)
    expect(patch.outreachStep).toBe(1)
    expect(patch.status).not.toBe('new')
  })
})

describe('nextStep / nextDueDate', () => {
  it('offers the first touch to an uncontacted lead, due today', () => {
    expect(nextStep(lead()).step).toBe(1)
    expect(nextDueDate(lead(), NOW)).toBe('2026-08-01')
  })

  it('returns null once the sequence is exhausted', () => {
    expect(nextStep(lead({ outreachStep: MAX_STEP }))).toBeNull()
    expect(nextDueDate(lead({ outreachStep: MAX_STEP }), NOW)).toBeNull()
  })

  it('spaces every touch from the first contact, not the last', () => {
    const contactedAt = new Date(NOW).toISOString()
    const dates = SEQUENCE.slice(1).map((_, i) =>
      nextDueDate({ outreachStep: i + 1, contactedAt }, NOW))
    // Strictly increasing, matching the configured gaps.
    expect(dates).toEqual(['2026-08-03', '2026-08-06', '2026-08-11', '2026-08-19', '2026-08-31'])
  })
})

describe('outreachSummary', () => {
  it('flags an uncontacted lead as the opportunity it is', () => {
    expect(outreachSummary(lead(), NOW).label).toBe('Not contacted')
  })

  it('marks a due follow-up as overdue', () => {
    const l = lead({ outreachStep: 1, contactedAt: daysAgo(9) })
    expect(outreachSummary(l, NOW).overdue).toBe(true)
  })

  it('does not nag before the next touch is due', () => {
    const l = lead({ outreachStep: 1, contactedAt: new Date(NOW).toISOString() })
    expect(outreachSummary(l, NOW).overdue).toBe(false)
  })

  it('says so when the sequence is finished', () => {
    expect(outreachSummary(lead({ outreachStep: MAX_STEP }), NOW).label).toBe('Sequence complete')
  })
})

describe('closeDeal', () => {
  it('records the real value on a win', () => {
    const patch = closeDeal(lead(), { won: true, value: '1500', now: NOW })
    expect(patch.status).toBe('won')
    expect(patch.wonValue).toBe(1500)
    expect(patch.followUpDate).toBeNull()
    expect(patch.lostReason).toBeNull()
  })

  it('never stores a negative or junk deal value', () => {
    expect(closeDeal(lead(), { won: true, value: -50 }).wonValue).toBe(0)
    expect(closeDeal(lead(), { won: true, value: 'abc' }).wonValue).toBe(0)
  })

  it('records why a deal was lost, so the pattern is learnable', () => {
    const patch = closeDeal(lead(), { won: false, reason: 'Too expensive', now: NOW })
    expect(patch.status).toBe('lost')
    expect(patch.lostReason).toBe('Too expensive')
    expect(patch.wonValue).toBeNull()
  })

  it('clears the follow-up so closed deals leave the work queue', () => {
    expect(closeDeal(lead({ followUpDate: '2026-09-01' }), { won: false }).followUpDate).toBeNull()
  })
})
