import { describe, it, expect } from 'vitest'
import { buildDailyDigest } from '../../../supabase/functions/_shared/digest.js'

const now = Date.parse('2026-10-19T12:00:00.000Z')

describe('daily digest', () => {
  it('cites stored changes and never includes a lead email address', () => {
    const digest = buildDailyDigest([
      {
        name: 'Loom & Dye',
        email: 'fake@example.com',
        status: 'contacted',
        followUpDate: '2026-10-18',
        watchLog: [{
          at: '2026-10-19T08:00:00.000Z',
          changes: [{ label: 'Online booking added', detail: 'A booking link (Fresha) is on the homepage now.' }],
        }],
      },
    ], now, 'Sam')
    expect(digest.text).toContain('Sam, here is your desk.')
    expect(digest.text).toContain('Fresha')
    expect(digest.text).toContain('2026-10-18')
    expect(digest.text).toContain('was not sent to any business')
    expect(digest.text).not.toContain('fake@example.com')
    expect(JSON.stringify(digest)).not.toContain('fake@example.com')
  })

  it('returns nothing when the desk is quiet', () => {
    expect(buildDailyDigest([], now)).toBeNull()
    expect(buildDailyDigest([
      { name: 'Won Cafe', status: 'won', email: 'fake@example.com', followUpDate: '2026-10-18', watchLog: [] },
    ], now)).toBeNull()
  })
})
