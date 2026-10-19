import { describe, expect, it } from 'vitest'
import {
  DESK_LIMITS,
  DESK_SYSTEM,
  DESK_TOOLS,
  enforceCitations,
  executeTool,
  finishDeskTurn,
  planAllowsDeskAgent,
  validateToolInput,
  wantsSend,
} from '../../../supabase/functions/_shared/deskAgent.js'
import { dueForRecheck, pickRecheckBatch, RECHECK_BATCH } from '../../../supabase/functions/_shared/recheckQueue.js'

const harbour = {
  id: 'sample-harbour',
  name: 'Harbour Coffee',
  btype: 'Café',
  city: 'Whitby',
  status: 'new',
  website: 'http://harbourcoffee.example',
  findings: [
    { id: 'no_https', evidence: 'harbourcoffee.example serves over plain http, so browsers show a "Not secure" warning to visitors.' },
    { id: 'no_booking', evidence: 'No booking or scheduling link found — every appointment has to go through a phone call.' },
  ],
  siteMeasurement: { reachable: true, https: false, responseMs: 3400 },
  benchmark: null,
  watchLog: [],
}

const loom = {
  id: 'sample-loom',
  name: 'Loom & Dye',
  status: 'contacted',
  website: 'https://loomdye.example',
  city: 'Whitby',
  findings: [],
  watchLog: [{
    at: '2026-10-14T08:00:00.000Z',
    changes: [{ label: 'Online booking added', detail: 'A booking link (Fresha) is on the homepage now. None was found last time.' }],
  }],
  lastWatchAt: '2026-10-14T08:00:00.000Z',
}

function ctx(leads = [harbour, loom]) {
  return { leads, citations: [], actions: [] }
}

describe('desk tool schema', () => {
  it('publishes the desk tools and rejects a send tool', () => {
    const names = DESK_TOOLS.map(tool => tool.name)
    expect(names).toEqual([
      'search_leads',
      'explain_lead',
      'compare_neighbours',
      'watch_log',
      'plan_prospect',
      'propose_recheck',
      'propose_move_stage',
      'draft_follow_up',
    ])
    for (const tool of DESK_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(10)
      expect(tool.input_schema.type).toBe('object')
      expect(tool.input_schema.properties).toBeTruthy()
    }
    expect(names.join(' ')).not.toMatch(/send|email|mail/)
    expect(validateToolInput('send_email', { to: 'a@b.com' }).ok).toBe(false)
    expect(validateToolInput('search_leads', { invented: true }).ok).toBe(false)
    expect(validateToolInput('explain_lead', {}).ok).toBe(false)
    expect(validateToolInput('propose_move_stage', { lead: 'Harbour Coffee', status: 'not-a-stage' }).ok).toBe(false)
    expect(validateToolInput('search_leads', { finding_id: 'no_booking' }).ok).toBe(true)
  })

  it('keeps the model on a short leash', () => {
    expect(DESK_LIMITS.perMinute).toBeLessThanOrEqual(12)
    expect(DESK_LIMITS.perDay).toBeLessThanOrEqual(400)
    expect(DESK_SYSTEM).toMatch(/\[\[cite:ID\]\]/)
    expect(DESK_SYSTEM.toLowerCase()).toMatch(/cannot send email/)
  })
})

describe('desk citations', () => {
  it('drops a sentence that states a fact without a stored citation', () => {
    const box = ctx()
    executeTool('explain_lead', { lead: 'Harbour Coffee' }, box)
    const text = enforceCitations(
      'Harbour Coffee has no booking [[cite:c2]]. Their revenue is $10k a month.',
      box.citations,
      ['Harbour Coffee', 'Loom & Dye'],
    )
    expect(text).toMatch(/\[\[cite:c2\]\]/)
    expect(text).not.toMatch(/10k|revenue/i)
    expect(box.citations.find(cite => cite.id === 'c2').text).toMatch(/No booking or scheduling link found/)
  })

  it('drops a number that was not in the cited measurement', () => {
    const box = ctx()
    executeTool('explain_lead', { lead: 'Harbour Coffee' }, box)
    const cite = box.citations.find(item => item.text.includes('plain http'))
    const text = enforceCitations(
      `The homepage took 9.9s [[cite:${cite.id}]].`,
      box.citations,
      ['Harbour Coffee'],
    )
    expect(text).not.toMatch(/9\.9/)
    expect(text).toMatch(/plain http/)
  })

  it('says when a neighbour comparison was never stored', () => {
    const box = ctx()
    const result = executeTool('compare_neighbours', { lead: 'Harbour Coffee' }, box)
    expect(result.summary).toMatch(/No neighbour measurement is stored for Harbour Coffee/)
    expect(result.citations[0].field).toBe('benchmark')
  })

  it('says when a lead has no finding', () => {
    const box = ctx()
    const result = executeTool('explain_lead', { lead: 'Loom & Dye' }, box)
    expect(result.summary).toMatch(/No measured finding is stored for Loom & Dye/)
  })

  it('filters search to a stored finding id', () => {
    const box = ctx()
    const result = executeTool('search_leads', { finding_id: 'no_booking' }, box)
    expect(result.citations.map(cite => cite.name)).toEqual(['Harbour Coffee'])
    expect(result.summary).toMatch(/No booking or scheduling link found/)
  })
})

describe('desk refuses to send or mutate', () => {
  it('refuses a send request and ignores the model text', () => {
    expect(wantsSend('send the email to Harbour Coffee')).toBe(true)
    expect(wantsSend('draft a follow-up for Harbour Coffee')).toBe(false)
    const turned = finishDeskTurn({
      message: 'send the email to Harbour Coffee',
      modelText: 'Sent! I emailed them the proof.',
      citations: [{ id: 'c1', name: 'Harbour Coffee', text: 'plain http' }],
      actions: [{ type: 'draft' }],
    })
    expect(turned.refusedSend).toBe(true)
    expect(turned.text).toMatch(/will not send/i)
    expect(turned.text).not.toMatch(/Sent/)
    expect(turned.actions).toEqual([])
  })

  it('treats a send-shaped tool name as a refusal', () => {
    const turned = finishDeskTurn({
      message: 'please help',
      modelText: 'On its way.',
      sawSendTool: true,
    })
    expect(turned.refusedSend).toBe(true)
    expect(turned.actions).toEqual([])
  })

  it('proposes a stage change and leaves the lead untouched', () => {
    const box = ctx()
    const before = JSON.stringify(box.leads)
    const result = executeTool('propose_move_stage', { lead: 'Harbour Coffee', status: 'contacted' }, box)
    expect(JSON.stringify(box.leads)).toBe(before)
    expect(result.action.needsConfirm).toBe(true)
    expect(result.action.status).toBe('contacted')
    expect(result.action.message).toMatch(/does not email/)
  })

  it('proposes a re-check instead of running one', () => {
    const box = ctx()
    const result = executeTool('propose_recheck', { lead: 'Harbour Coffee' }, box)
    expect(result.action.type).toBe('recheck')
    expect(result.action.needsConfirm).toBe(true)
    expect(result.summary).toMatch(/http:\/\/harbourcoffee\.example/)
  })

  it('plans a scan without naming a business', () => {
    const box = ctx()
    executeTool('plan_prospect', { city: 'Austin', country: 'United States', category: 'dentists', constraint: 'no_booking', count: 10 }, box)
    const turned = finishDeskTurn({
      message: 'find 10 dentists in Austin with no booking',
      modelText: 'I found Oak Dental and they make $4000 a month.',
      actions: box.actions,
      leadNames: ['Harbour Coffee'],
    })
    expect(turned.source).toBe('plan')
    expect(turned.text).toMatch(/Austin, United States/)
    expect(turned.text).toMatch(/No online booking/)
    expect(turned.text).toMatch(/Nothing is measured/)
    expect(turned.text).not.toMatch(/Oak Dental|4000/)
  })

  it('replaces an uncited story with the records line', () => {
    const turned = finishDeskTurn({
      message: 'write a poem about my pipeline',
      modelText: 'Roses are red, leads are gold.',
      leadNames: ['Harbour Coffee'],
    })
    expect(turned.text).toMatch(/Nothing on this desk matches/)
    expect(turned.source).toBe('records')
  })
})

describe('desk plan gate', () => {
  const future = new Date(Date.now() + 86_400_000).toISOString()
  const past = new Date(Date.now() - 86_400_000).toISOString()

  it('allows pro, scale, enterprise, the owner, and an active trial', () => {
    expect(planAllowsDeskAgent({ plan: 'free', role: 'user' })).toBe(false)
    expect(planAllowsDeskAgent({ plan: 'starter', role: 'user' })).toBe(false)
    expect(planAllowsDeskAgent({ plan: 'growth', role: 'user' })).toBe(false)
    expect(planAllowsDeskAgent({ plan: 'pro', role: 'user' })).toBe(true)
    expect(planAllowsDeskAgent({ plan: 'scale', role: 'user' })).toBe(true)
    expect(planAllowsDeskAgent({ plan: 'enterprise', role: 'user' })).toBe(true)
    expect(planAllowsDeskAgent({ plan: 'free', role: 'owner' })).toBe(true)
    expect(planAllowsDeskAgent({ plan: 'free', role: 'user', trial_end: future })).toBe(true)
    expect(planAllowsDeskAgent({ plan: 'free', role: 'user', trial_end: past })).toBe(false)
    expect(planAllowsDeskAgent(null)).toBe(false)
  })
})

describe('scheduled re-check queue', () => {
  const now = Date.parse('2026-10-19T06:15:00.000Z')

  it('picks never-checked sites first and skips fresh or lost ones', () => {
    const leads = [
      { id: 'new', website: 'https://new.example', status: 'new', lastWatchAt: null },
      { id: 'fresh', website: 'https://fresh.example', status: 'new', lastWatchAt: '2026-10-18T06:15:00.000Z' },
      { id: 'old', website: 'https://old.example', status: 'contacted', lastWatchAt: '2026-10-01T00:00:00.000Z' },
      { id: 'lost', website: 'https://lost.example', status: 'lost', lastWatchAt: null },
      { id: 'blank', website: '', status: 'new', lastWatchAt: null },
    ]
    expect(dueForRecheck(leads[0], now)).toBe(true)
    expect(dueForRecheck(leads[1], now)).toBe(false)
    expect(dueForRecheck(leads[3], now)).toBe(false)
    const batch = pickRecheckBatch(leads, now, RECHECK_BATCH)
    expect(batch.map(lead => lead.id)).toEqual(['new', 'old'])
  })
})
