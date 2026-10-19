import { describe, it, expect } from 'vitest'
import { crmCsv } from '../helpers'

describe('CRM export', () => {
  it('uses stored columns and leaves prospect email out', () => {
    const csv = crmCsv([{
      name: 'North Cafe',
      email: 'fake@example.com',
      phone: '+44 1',
      website: 'http://north.example',
      city: 'Leeds',
      country: 'United Kingdom',
      status: 'contacted',
      followUpDate: '2026-10-18',
      auditedAt: '2026-10-01T12:00:00.000Z',
      findings: [{ evidence: 'north.example serves over plain http.' }],
    }])
    const header = csv.split('\n')[0]
    expect(header).not.toMatch(/email/i)
    expect(csv).not.toContain('fake@example.com')
    expect(csv).toContain('plain http')
    expect(csv).toContain('2026-10-18')
    expect(csv).toContain('2026-10-01')
  })
})
