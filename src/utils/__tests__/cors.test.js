import { describe, it, expect } from 'vitest'
import { allowList, normalizeOrigin, resolveAllowOrigin, siteOrigins } from '../../../supabase/functions/_shared/cors.js'
import { SITE_ORIGIN } from '../../constants/site.js'

describe('function CORS origins', () => {
  it('trims, drops trailing slashes, and lowercases a configured origin', () => {
    expect(normalizeOrigin('  HTTPS://WWW.Zenvylo.app/  ')).toBe('https://www.zenvylo.app')
  })

  it('always allows the apex and www hosts from the site constant', () => {
    expect(siteOrigins()).toEqual(['https://zenvylo.app', 'https://www.zenvylo.app'])
    expect(SITE_ORIGIN).toBe('https://zenvylo.app')
    const allowed = allowList('https://www.zenvylo.app/')
    expect(allowed.has('https://zenvylo.app')).toBe(true)
    expect(allowed.has('https://www.zenvylo.app')).toBe(true)
  })

  it('echoes the request origin when the slashed secret matches', () => {
    const configured = 'https://www.zenvylo.app/'
    expect(resolveAllowOrigin('https://www.zenvylo.app', configured)).toBe('https://www.zenvylo.app')
    expect(resolveAllowOrigin('https://zenvylo.app', configured)).toBe('https://zenvylo.app')
  })

  it('does not echo a configured origin for a different site', () => {
    expect(resolveAllowOrigin('https://evil.example', 'https://www.zenvylo.app/')).toBe('')
    expect(resolveAllowOrigin('', 'https://www.zenvylo.app/')).toBe('')
  })

  it('keeps a wildcard only when no allow-list is configured', () => {
    expect(resolveAllowOrigin('http://localhost:5173', '')).toBe('*')
    expect(resolveAllowOrigin('https://zenvylo.app', '   ')).toBe('https://zenvylo.app')
  })
})
