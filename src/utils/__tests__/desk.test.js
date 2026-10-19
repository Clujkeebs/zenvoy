import { describe, it, expect } from 'vitest'
import { bestNewLeads, buildDesk } from '../desk'

const lead = (over = {}) => ({
  id: over.id || Math.random().toString(36).slice(2),
  name: 'Biz',
  status: 'new',
  score: 40,
  website: 'https://example.com',
  findings: [{ id: 'no_https' }],
  ...over,
})

describe('bestNewLeads', () => {
  it('skips leads that have already been contacted', () => {
    const rows = bestNewLeads([
      lead({ id: 'a', status: 'contacted', score: 99 }),
      lead({ id: 'b', status: 'new', score: 50 }),
      lead({ id: 'c', status: 'new', score: 80 }),
    ])
    expect(rows.map(r => r.id)).toEqual(['c', 'b'])
  })
})

describe('buildDesk', () => {
  it('counts a due follow-up and an unseen site change separately', () => {
    const now = Date.parse('2026-10-19T12:00:00.000Z')
    const desk = buildDesk([
      lead({
        id: 'due',
        status: 'contacted',
        followUpDate: '2026-10-18',
        score: 60,
      }),
      lead({
        id: 'fresh',
        status: 'new',
        score: 90,
        watchSeenAt: '2026-10-01T00:00:00.000Z',
        watchLog: [{
          at: '2026-10-18T00:00:00.000Z',
          changes: [{ key: 'reachable', direction: 'broke', label: 'Website stopped loading', detail: 'Timed out' }],
        }],
      }),
      lead({ id: 'quiet', status: 'won', score: 10, website: null }),
    ], { now })

    expect(desk.due).toBe(1)
    expect(desk.changeCount).toBe(1)
    expect(desk.changes[0].lead.id).toBe('fresh')
    expect(desk.fresh[0].id).toBe('fresh')
    expect(desk.watching).toBe(2)
  })
})
