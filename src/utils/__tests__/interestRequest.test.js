import { describe, it, expect } from 'vitest'
import { readInterestRequest } from '../../../supabase/functions/_shared/interestRequest.js'

describe('proof reply request', () => {
  it('keeps a name and a short note', () => {
    const read = readInterestRequest({ token: 'abc', fromName: '  Ada  ', note: 'Call me' })
    expect(read.ok).toBe(true)
    expect(read.fromName).toBe('Ada')
    expect(read.note).toBe('Call me')
  })

  it('rejects a missing name, a missing token, and an oversized token', () => {
    expect(readInterestRequest({ token: 'abc', fromName: '  ' }).ok).toBe(false)
    expect(readInterestRequest({ fromName: 'Ada' }).error).toMatch(/not a report/)
    expect(readInterestRequest({ token: 'x'.repeat(20_001), fromName: 'Ada' }).ok).toBe(false)
    expect(readInterestRequest(null).status).toBe(400)
  })

  it('cuts a long note at 500 characters', () => {
    const read = readInterestRequest({ token: 'abc', fromName: 'Ada', note: 'n'.repeat(800) })
    expect(read.note).toHaveLength(500)
  })
})