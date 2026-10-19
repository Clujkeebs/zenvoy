import { describe, it, expect } from 'vitest'
import { localNotices } from '../notices'

const now = Date.parse('2026-10-19T12:00:00.000Z')

describe('desk notices', () => {
  it('surfaces an unseen measurement change and a due follow-up', () => {
    const items = localNotices([
      {
        id: 'loom',
        name: 'Loom & Dye',
        status: 'contacted',
        followUpDate: '2026-10-18',
        watchSeenAt: null,
        watchLog: [{
          at: '2026-10-14T08:00:00.000Z',
          changes: [{ key: 'booking', label: 'Online booking added', detail: 'A booking link (Fresha) is on the homepage now.' }],
        }],
      },
      { id: 'won', name: 'Closed', status: 'won', followUpDate: '2026-10-01', watchLog: [] },
    ], now)
    const follow = items.find(item => item.kind === 'follow_up')
    const watch = items.find(item => item.kind === 'watch')
    expect(follow.body).toMatch(/Nothing has been emailed/)
    expect(watch.body).toMatch(/Fresha/)
    expect(items.some(item => item.leadId === 'won')).toBe(false)
  })

  it('hides a change the freelancer already marked seen', () => {
    const items = localNotices([{
      id: 'pike',
      name: 'Pike Plumbing',
      status: 'new',
      watchSeenAt: '2026-10-18T00:00:00.000Z',
      watchLog: [{
        at: '2026-10-17T07:00:00.000Z',
        changes: [{ key: 'reachable', label: 'Website stopped loading', detail: 'Timed out after 8s.' }],
      }],
    }], now)
    expect(items.some(item => item.kind === 'watch')).toBe(false)
  })
})
