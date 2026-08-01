import { describe, it, expect } from 'vitest'
import { buildWorkQueue, conversionByFinding, pipelineStats } from '../workqueue'

/* The work queue is the answer to "why not just use a chat assistant" — it
 * depends on remembering your pipeline over weeks. Worth pinning the rules.
 */

const NOW = Date.parse('2026-07-30T12:00:00Z')
const daysAgo = n => new Date(NOW - n * 86400000).toISOString()
const dateDaysAgo = n => daysAgo(n).slice(0, 10)

const lead = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  name: 'Some Business',
  status: 'new',
  score: 50,
  findings: [{ id: 'no_https', label: 'No HTTPS', evidence: 'serves over plain http' }],
  createdAt: daysAgo(1),
  website: 'https://x.com',
  auditedAt: daysAgo(1),
  ...over,
})

describe('buildWorkQueue', () => {
  it('is empty when there are no leads', () => {
    expect(buildWorkQueue([], { now: NOW }).total).toBe(0)
  })

  it('surfaces follow-ups that are due', () => {
    const q = buildWorkQueue([
      lead({ status: 'contacted', followUpDate: dateDaysAgo(1) }),
      lead({ status: 'contacted', followUpDate: dateDaysAgo(-5) }), // future
    ], { now: NOW })
    const g = q.groups.find(x => x.id === 'followups')
    expect(g.count).toBe(1)
  })

  it('treats a follow-up dated today as due', () => {
    const q = buildWorkQueue(
      [lead({ status: 'contacted', followUpDate: dateDaysAgo(0) })], { now: NOW })
    expect(q.groups.find(x => x.id === 'followups').count).toBe(1)
  })

  it('ranks uncontacted leads by score', () => {
    const q = buildWorkQueue([
      lead({ name: 'Low', score: 20 }),
      lead({ name: 'High', score: 90 }),
      lead({ name: 'Mid', score: 55 }),
    ], { now: NOW })
    const g = q.groups.find(x => x.id === 'untouched')
    expect(g.leads.map(l => l.name)).toEqual(['High', 'Mid', 'Low'])
  })

  it('flags contacted leads that have gone quiet, oldest first', () => {
    const q = buildWorkQueue([
      lead({ name: 'Recent', status: 'contacted', contactedAt: daysAgo(2) }),
      lead({ name: 'Ancient', status: 'contacted', contactedAt: daysAgo(30) }),
      lead({ name: 'Stale', status: 'contacted', contactedAt: daysAgo(10) }),
    ], { now: NOW })
    const g = q.groups.find(x => x.id === 'quiet')
    expect(g.leads.map(l => l.name)).toEqual(['Ancient', 'Stale'])
  })

  it('does not nag about a lead that already has a follow-up planned', () => {
    const q = buildWorkQueue([
      lead({ status: 'contacted', contactedAt: daysAgo(30), followUpDate: dateDaysAgo(-3) }),
    ], { now: NOW })
    expect(q.groups.find(x => x.id === 'quiet')).toBeUndefined()
  })

  it('ignores closed deals entirely', () => {
    const q = buildWorkQueue([
      lead({ status: 'won', contactedAt: daysAgo(60) }),
      lead({ status: 'lost', contactedAt: daysAgo(60) }),
    ], { now: NOW })
    expect(q.total).toBe(0)
  })

  it('asks for a re-check when the evidence has gone stale', () => {
    const q = buildWorkQueue([
      lead({ status: 'contacted', contactedAt: daysAgo(1), auditedAt: daysAgo(45) }),
    ], { now: NOW })
    expect(q.groups.find(x => x.id === 'reverify').count).toBe(1)
  })

  it('does not ask to re-check a lead with no website or no findings', () => {
    const q = buildWorkQueue([
      lead({ status: 'contacted', contactedAt: daysAgo(1), website: null, auditedAt: daysAgo(60) }),
      lead({ status: 'contacted', contactedAt: daysAgo(1), findings: [], auditedAt: daysAgo(60) }),
    ], { now: NOW })
    expect(q.groups.find(x => x.id === 'reverify')).toBeUndefined()
  })

  it('never lists the same lead as both due and untouched', () => {
    const l = lead({ status: 'new', followUpDate: dateDaysAgo(1) })
    const q = buildWorkQueue([l], { now: NOW })
    const ids = q.groups.flatMap(g => g.leads.map(x => x.id))
    expect(ids.filter(id => id === l.id)).toHaveLength(1)
  })

  it('caps how many it shows per group but reports the true count', () => {
    const many = Array.from({ length: 12 }, (_, i) => lead({ score: i }))
    const g = buildWorkQueue(many, { now: NOW }).groups.find(x => x.id === 'untouched')
    expect(g.count).toBe(12)
    expect(g.leads).toHaveLength(5)
  })
})

describe('conversionByFinding', () => {
  it('refuses to draw conclusions from a small sample', () => {
    const res = conversionByFinding([lead({ status: 'won' })])
    expect(res.ready).toBe(false)
    expect(res.needed).toBe(8)
  })

  it('reports which evidence precedes wins once there is enough data', () => {
    const withFinding = (id, status) => lead({
      status, findings: [{ id, label: id }],
    })
    const leads = [
      ...Array.from({ length: 4 }, () => withFinding('no_website', 'won')),
      ...Array.from({ length: 1 }, () => withFinding('no_website', 'lost')),
      ...Array.from({ length: 1 }, () => withFinding('no_analytics', 'won')),
      ...Array.from({ length: 4 }, () => withFinding('no_analytics', 'lost')),
    ]
    const res = conversionByFinding(leads)
    expect(res.ready).toBe(true)
    expect(res.rows[0].id).toBe('no_website')
    expect(res.rows[0].rate).toBeCloseTo(0.8)
  })

  it('counts a finding once per lead even if it repeats', () => {
    const dupes = Array.from({ length: 8 }, () => lead({
      status: 'won',
      findings: [{ id: 'no_https', label: 'a' }, { id: 'no_https', label: 'a' }],
    }))
    const res = conversionByFinding(dupes)
    expect(res.rows[0].total).toBe(8)
  })
})

describe('pipelineStats', () => {
  it('computes win rate against contacted leads, not all leads', () => {
    const s = pipelineStats([
      lead({ status: 'new' }),
      lead({ status: 'new' }),
      lead({ status: 'won' }),
      lead({ status: 'lost' }),
    ])
    // 1 won out of 2 contacted — the 2 untouched leads don't count against you.
    expect(s.winRate).toBe(0.5)
    expect(s.total).toBe(4)
  })

  it('is not NaN before anything has been contacted', () => {
    expect(pipelineStats([lead({ status: 'new' })]).winRate).toBe(0)
  })

  it('prefers the recorded won value over the asking rate', () => {
    const s = pipelineStats([lead({ status: 'won', suggestedMonthlyRate: 500, wonValue: 1200 })])
    expect(s.wonValue).toBe(1200)
  })
})
