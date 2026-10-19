import { describe, it, expect } from 'vitest'
import { secretsMatch } from '../../../supabase/functions/_shared/cronAuth.js'

const SECRET = 'recheck-secret-value'

describe('cron header check', () => {
  it('accepts the same 16+ character secret', () => {
    expect(secretsMatch(SECRET, SECRET)).toBe(true)
  })

  it('rejects a short, missing, or different secret', () => {
    expect(secretsMatch('short-secret', 'short-secret')).toBe(false)
    expect(secretsMatch('', SECRET)).toBe(false)
    expect(secretsMatch(SECRET + 'x', SECRET)).toBe(false)
    expect(secretsMatch('recheck-secret-valuX', SECRET)).toBe(false)
  })
})
