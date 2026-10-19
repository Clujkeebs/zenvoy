import { describe, expect, it } from 'vitest'
import {
  parseGoal,
  selectForGoal,
  buildDigest,
  nextActions,
  draftFollowUp,
  proposeAction,
  answerDesk,
  agentLimits,
  categoryMatches,
} from '../agent'

const dentist = {
  id: 'd1',
  name: 'Oak Dental',
  btype: 'Dental Practice',
  osmTagValue: 'dentist',
  city: 'Austin',
  website: 'https://oak.example',
  status: 'new',
  score: 40,
  auditedAt: '2026-10-01T00:00:00.000Z',
  siteMeasurement: { reachable: true, https: true, hasBookingLink: false },
  findings: [{
    id: 'no_booking',
    label: 'No online booking',
    evidence: 'No booking or scheduling link found — every appointment has to go through a phone call.',
  }],
}

const cafe = {
  id: 'c1',
  name: 'Harbour Coffee',
  btype: 'Café',
  city: 'Whitby',
  website: 'http://harbour.example',
  status: 'new',
  score: 70,
  findings: [{
    id: 'no_https',
    label: 'No HTTPS',
    evidence: 'harbour.example serves over plain http.',
  }],
  siteMeasurement: { reachable: true, https: false },
  watchLog: [{
    at: '2026-10-18T12:00:00.000Z',
    changes: [{
      key: 'https',
      direction: 'broke',
      label: 'HTTPS lost',
      detail: 'harbour.example was on https and is now served over plain http.',
    }],
  }],
}

describe('parseGoal', () => {
  it('reads a count, a type, a city, and a measured filter', () => {
    const plan = parseGoal('find 10 dentists in Austin with no online booking')
    expect(plan.ok).toBe(true)
    expect(plan.goal.count).toBe(10)
    expect(plan.goal.category.id).toBe('dentist')
    expect(plan.goal.city).toBe('Austin')
    expect(plan.goal.country).toBe('United States')
    expect(plan.goal.countryInferred).toBe(true)
    expect(plan.goal.constraint.id).toBe('no_booking')
    expect(plan.plan.join(' ')).toMatch(/1 scan/)
    expect(plan.plan.join(' ')).toMatch(/Nothing is emailed/)
  })

  it('asks for a city instead of inventing one', () => {
    const plan = parseGoal('find 5 plumbers with no https')
    expect(plan.ok).toBe(false)
    expect(plan.missing).toContain('city')
  })

  it('caps the count at the plan maximum', () => {
    const plan = parseGoal('find 90 cafés in London', { maxCount: 8 })
    expect(plan.goal.count).toBe(8)
    expect(plan.goal.country).toBe('United Kingdom')
  })
})

describe('selectForGoal', () => {
  it('keeps only businesses with the measured finding', () => {
    const goal = parseGoal('find 10 dentists in Austin with no online booking').goal
    const { matches, skipped } = selectForGoal([dentist, cafe], goal)
    expect(matches.map(m => m.lead.name)).toEqual(['Oak Dental'])
    expect(matches[0].citation.text).toMatch(/booking/)
    expect(skipped.some(s => s.lead.name === 'Harbour Coffee')).toBe(true)
  })

  it('matches a map type', () => {
    expect(categoryMatches({ name: 'Smile', btype: 'Dental Practice' }, { words: ['dentist'], btypes: ['Dental Practice'], osm: ['dentist'] })).toBe(true)
    expect(categoryMatches({ name: 'Smile', btype: 'Café' }, { words: ['dentist'], btypes: ['Dental Practice'], osm: ['dentist'] })).toBe(false)
  })
})

describe('digest and next actions', () => {
  const now = Date.parse('2026-10-19T00:00:00.000Z')

  it('counts only watch-log changes inside the week', () => {
    const digest = buildDigest([cafe, {
      ...dentist,
      watchLog: [{ at: '2026-01-01T00:00:00.000Z', changes: [{ key: 'booking', label: 'Old', detail: 'Too old.' }] }],
    }], now)
    expect(digest.events).toHaveLength(1)
    expect(digest.events[0].detail).toMatch(/plain http/)
    expect(digest.summary).toBe('1 measured change in the last 7 days.')
  })

  it('says when nothing changed', () => {
    expect(buildDigest([dentist], now).summary).toMatch(/No measured changes/)
  })

  it('suggests a draft that cites a finding', () => {
    const actions = nextActions([dentist], now)
    expect(actions[0].reason).toMatch(/booking/)
    expect(actions[0].type).not.toBe('send')
  })
})

describe('drafts and the desk', () => {
  it('quotes findings and does not claim the email was sent', () => {
    const draft = draftFollowUp(dentist, 'Sam')
    expect(draft.ok).toBe(true)
    expect(draft.body).toContain(dentist.findings[0].evidence)
    expect(draft.body).toMatch(/has not been sent/)
    expect(draft.body).not.toMatch(/\d+%/)
  })

  it('refuses to draft when there is no measurement', () => {
    const draft = draftFollowUp({ name: 'Empty', findings: [] })
    expect(draft.ok).toBe(false)
    expect(draft.body).toMatch(/no measured finding/)
  })

  it('refuses to send and will move a stage only after a real lead matches', () => {
    expect(proposeAction('send the email to Oak Dental', [dentist]).type).toBe('refuse_send')
    const move = proposeAction('move Oak Dental to contacted', [dentist])
    expect(move.type).toBe('move_stage')
    expect(move.needsConfirm).toBe(true)
    expect(move.status).toBe('contacted')
    expect(proposeAction('move Nobody to contacted', [dentist]).type).toBe('missing_lead')
  })

  it('answers from a stored finding and admits when nothing matches', () => {
    const hit = answerDesk('which dentist has no booking?', [dentist, cafe])
    expect(hit.text).toMatch(/Oak Dental/)
    expect(hit.citations[0].text).toMatch(/booking/)
    const miss = answerDesk('what is their annual revenue?', [dentist])
    expect(miss.citations).toEqual([])
    expect(miss.text).toMatch(/Nothing on this desk/)
  })

  it('gates the model rewrite to plans that already have AI', () => {
    expect(agentLimits({ plan: 'free' }).model).toBe(false)
    expect(agentLimits({ plan: 'pro' }).model).toBe(true)
    expect(agentLimits({ plan: 'growth', scansUsed: 50 }).scansLeft).toBe(0)
  })
})
