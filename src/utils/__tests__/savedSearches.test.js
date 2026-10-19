import { describe, it, expect, beforeEach } from 'vitest'
import { rememberSearch, loadSavedSearches, forgetSearch } from '../savedSearches'

beforeEach(() => {
  const store = new Map()
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: key => store.delete(key),
  }
})

describe('saved searches', () => {
  it('remembers a place and forgets it without running a scan', () => {
    const saved = rememberSearch({
      id: 's1',
      label: 'Web design in Whitby',
      country: 'United Kingdom',
      city: 'Whitby',
      serviceId: 'web',
      leadCount: 5,
    })
    expect(saved).toHaveLength(1)
    expect(loadSavedSearches()[0].city).toBe('Whitby')
    expect(forgetSearch('s1')).toEqual([])
  })

  it('replaces the same label instead of stacking copies', () => {
    rememberSearch({ id: 'a', label: 'SEO in Leeds', country: 'United Kingdom', serviceId: 'seo' })
    const next = rememberSearch({ id: 'b', label: 'SEO in Leeds', country: 'United Kingdom', city: 'Leeds', serviceId: 'seo' })
    expect(next).toHaveLength(1)
    expect(next[0].city).toBe('Leeds')
  })
})
