import { describe, it, expect } from 'vitest'
import {
  PLANS, PLAN_ORDER, canAI, canMulti, canScale,
  getScansLimit, getScansLeft, getTotalScansLeft, getLeadsPerScan, isPaidPlan,
  getLeadCap, canChooseLeadCount, MAX_LEADS_PER_SCAN,
} from '../../constants/plans'
import { isOwner, isAdmin, isModerator, getDefaultRole } from '../roles'
import { resolveService, normalizeServiceName, SERVICES } from '../../constants/services'

/* Entitlement maths. These numbers decide what people get for their money, so
 * they're worth pinning down — and the client copy has to agree with
 * plan_scan_limit() in the migration.
 */

describe('plan limits', () => {
  it('matches the limits the database enforces in plan_scan_limit()', () => {
    // Keep this table in sync with supabase/migrations/*_hardening.sql.
    expect(PLANS.free.scans).toBe(3)
    expect(PLANS.starter.scans).toBe(20)
    expect(PLANS.growth.scans).toBe(50)
    expect(PLANS.pro.scans).toBe(100)
    expect(PLANS.scale.scans).toBe(200)
    expect(PLANS.enterprise.scans).toBe(500)
  })

  it('lists every plan in PLAN_ORDER exactly once', () => {
    expect([...PLAN_ORDER].sort()).toEqual(Object.keys(PLANS).sort())
  })

  it('defaults an unknown plan to the free allowance', () => {
    expect(getScansLimit({ plan: 'nonsense' })).toBe(3)
  })
})

describe('scan accounting', () => {
  it('never reports a negative balance', () => {
    expect(getScansLeft({ plan: 'free', scansUsed: 99 })).toBe(0)
  })

  it('adds bonus scans on top of the plan allowance', () => {
    expect(getTotalScansLeft({ plan: 'free', scansUsed: 3, bonusScans: 4 })).toBe(4)
  })

  it('gives the owner unlimited scans', () => {
    expect(getScansLeft({ role: 'owner', plan: 'free', scansUsed: 500 })).toBe(Infinity)
  })
})

describe('feature gates', () => {
  it('restricts AI to Pro and above', () => {
    expect(canAI({ plan: 'free' })).toBe(false)
    expect(canAI({ plan: 'growth' })).toBe(false)
    expect(canAI({ plan: 'pro' })).toBe(true)
    expect(canAI({ plan: 'scale' })).toBe(true)
  })

  it('gives the owner everything', () => {
    const owner = { role: 'owner', plan: 'free' }
    expect(canAI(owner)).toBe(true)
    expect(canMulti(owner)).toBe(true)
    expect(canScale(owner)).toBe(true)
    expect(getLeadsPerScan(owner)).toBeGreaterThan(100)
  })

  it('does not treat free as a paid plan', () => {
    expect(isPaidPlan({ plan: 'free' })).toBe(false)
    expect(isPaidPlan({ plan: 'starter' })).toBe(true)
  })
})

describe('roles', () => {
  it('treats owner as an admin but not the reverse', () => {
    expect(isAdmin({ role: 'owner' })).toBe(true)
    expect(isOwner({ role: 'admin' })).toBe(false)
  })

  it('counts admins and owners as moderators', () => {
    expect(isModerator({ role: 'admin' })).toBe(true)
    expect(isModerator({ role: 'owner' })).toBe(true)
    expect(isModerator({ role: 'user' })).toBe(false)
  })

  it('defaults everyone to plain user', () => {
    // The signup trigger is what actually assigns roles now; this helper must
    // never hand out anything elevated on its own.
    expect(getDefaultRole('somebody@example.com')).toBe('user')
  })

  it('treats a missing role as user', () => {
    expect(isAdmin({})).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })
})

describe('resolveService', () => {
  it('returns the preset when given a known id', () => {
    const s = resolveService('seo', '')
    expect(s.isCustom).toBe(false)
    expect(s.label).toBe(SERVICES.find(x => x.id === 'seo').label)
  })

  it('accepts a service the user typed', () => {
    const s = resolveService('', 'Drone photography')
    expect(s.isCustom).toBe(true)
    expect(s.id).toBe('custom')
    expect(s.label).toBe('Drone photography')
  })

  it('caps a very long typed service', () => {
    const s = resolveService('', 'x'.repeat(200))
    expect(s.label.length).toBeLessThanOrEqual(60)
  })

  it('falls back to the first preset when given nothing', () => {
    expect(resolveService('', '').isCustom).toBe(false)
  })

  it('collapses whitespace when normalising', () => {
    expect(normalizeServiceName('  Menu   design  ')).toBe('Menu design')
  })
})

describe('lead count picker', () => {
  it('caps the picker at the plan entitlement', () => {
    expect(getLeadCap({ plan: 'free' })).toBe(5)
    expect(getLeadCap({ plan: 'growth' })).toBe(8)
    expect(getLeadCap({ plan: 'scale' })).toBe(15)
    expect(getLeadCap({ plan: 'enterprise' })).toBe(25)
  })

  it('gives the owner a usable number rather than the entitlement', () => {
    // getLeadsPerScan reports 9999 for the owner; a single scan can't fetch and
    // measure that many, so the picker is bounded.
    expect(getLeadsPerScan({ role: 'owner' })).toBe(9999)
    expect(getLeadCap({ role: 'owner' })).toBe(MAX_LEADS_PER_SCAN)
  })

  it('only offers the picker where the plan leaves room to choose', () => {
    expect(canChooseLeadCount({ plan: 'free' })).toBe(false)
    expect(canChooseLeadCount({ plan: 'starter' })).toBe(false)
    expect(canChooseLeadCount({ plan: 'growth' })).toBe(true)
    expect(canChooseLeadCount({ plan: 'pro' })).toBe(true)
    expect(canChooseLeadCount({ role: 'owner' })).toBe(true)
  })

  it('never returns a cap above what one scan can deliver', () => {
    for (const plan of PLAN_ORDER) {
      expect(getLeadCap({ plan })).toBeLessThanOrEqual(MAX_LEADS_PER_SCAN)
      expect(getLeadCap({ plan })).toBeGreaterThan(0)
    }
  })
})
