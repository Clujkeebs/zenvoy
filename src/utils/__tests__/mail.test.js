import { describe, it, expect } from 'vitest'
import { emailFreelancer } from '../../../supabase/functions/_shared/mail.js'

describe('freelancer email', () => {
  it('does not call the provider when mail is not configured', async () => {
    let called = false
    const sent = await emailFreelancer({
      to: 'sam@example.com',
      subject: 'Desk',
      text: 'Hello',
      key: '',
      from: '',
      fetchImpl: () => { called = true },
    })
    expect(sent).toBe(false)
    expect(called).toBe(false)
  })

  it('sends only to the address it was given', async () => {
    let body = null
    const sent = await emailFreelancer({
      to: 'sam@example.com',
      subject: 'Desk',
      text: 'A note. fake@example.com was not a recipient.',
      key: 're_test',
      from: 'Zenvylo <notes@example.com>',
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body)
        return { ok: true }
      },
    })
    expect(sent).toBe(true)
    expect(body.to).toEqual(['sam@example.com'])
    expect(body.to).not.toContain('fake@example.com')
  })
})
