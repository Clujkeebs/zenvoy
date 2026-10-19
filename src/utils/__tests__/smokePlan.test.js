import { describe, it, expect } from 'vitest'
import { smokePlan, SMOKE_STEPS } from '../smokePlan'

describe('live smoke plan', () => {
  it('skips cleanly when nothing is configured', () => {
    const plan = smokePlan({})
    expect(plan.run).toBe(false)
    expect(plan.incomplete).toBe(false)
  })

  it('fails closed when only some credentials are set', () => {
    const plan = smokePlan({ SMOKE_SUPABASE_URL: 'https://example.supabase.co' })
    expect(plan.run).toBe(false)
    expect(plan.incomplete).toBe(true)
    expect(plan.reason).toMatch(/SMOKE_SUPABASE_ANON_KEY/)
  })

  it('refuses a URL that is not a Supabase project', () => {
    const plan = smokePlan({
      SMOKE_SUPABASE_URL: 'http://localhost:54321',
      SMOKE_SUPABASE_ANON_KEY: 'anon',
      SMOKE_EMAIL: 'smoke@example.com',
      SMOKE_PASSWORD: 'secret-secret',
    })
    expect(plan.run).toBe(false)
    expect(plan.incomplete).toBe(true)
  })

  it('runs the full flow when the four values are present', () => {
    const plan = smokePlan({
      SMOKE_SUPABASE_URL: 'https://abc.supabase.co/',
      SMOKE_SUPABASE_ANON_KEY: 'anon',
      SMOKE_EMAIL: 'smoke@example.com',
      SMOKE_PASSWORD: 'secret-secret',
    })
    expect(plan.run).toBe(true)
    expect(plan.url).toBe('https://abc.supabase.co')
    expect(plan.site).toBe('https://example.com')
    expect(plan.steps).toEqual(SMOKE_STEPS)
  })
})
