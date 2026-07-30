import { describe, it, expect } from 'vitest'
import { verifyStripeEvent, StripeSignatureError } from '../stripe.ts'

/* The webhook had no signature check at all, so anyone who knew the URL could
 * POST a fake subscription event and grant themselves any plan for free. These
 * tests are the guard on that door.
 */

const SECRET = 'whsec_test_secret_do_not_use'

async function sign(payload, secret = SECRET, timestamp = Math.floor(Date.now() / 1000)) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const mac = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`),
  )
  const hex = Array.from(new Uint8Array(mac))
    .map(b => b.toString(16).padStart(2, '0')).join('')
  return `t=${timestamp},v1=${hex}`
}

const body = JSON.stringify({
  id: 'evt_1',
  type: 'customer.subscription.updated',
  data: { object: { metadata: { supabase_uid: 'user-1', plan: 'scale' }, status: 'active' } },
})

describe('verifyStripeEvent', () => {
  it('accepts a correctly signed payload', async () => {
    const event = await verifyStripeEvent(body, await sign(body), SECRET)
    expect(event.id).toBe('evt_1')
    expect(event.data.object.metadata.plan).toBe('scale')
  })

  it('rejects the forged request that used to work', async () => {
    // Exactly the attack the old handler accepted: a plain POST, no signature.
    await expect(verifyStripeEvent(body, null, SECRET))
      .rejects.toBeInstanceOf(StripeSignatureError)
  })

  it('rejects a payload signed with the wrong secret', async () => {
    const header = await sign(body, 'whsec_attacker_guess')
    await expect(verifyStripeEvent(body, header, SECRET))
      .rejects.toThrow(/Signature mismatch/)
  })

  it('rejects a tampered body under a valid signature', async () => {
    const header = await sign(body)
    const tampered = body.replace('"scale"', '"enterprise"')
    await expect(verifyStripeEvent(tampered, header, SECRET))
      .rejects.toThrow(/Signature mismatch/)
  })

  it('rejects a replayed event outside the tolerance window', async () => {
    const old = Math.floor(Date.now() / 1000) - 3600
    await expect(verifyStripeEvent(body, await sign(body, SECRET, old), SECRET))
      .rejects.toThrow(/outside tolerance/)
  })

  it('accepts a slightly old event inside the window', async () => {
    const recent = Math.floor(Date.now() / 1000) - 120
    const event = await verifyStripeEvent(body, await sign(body, SECRET, recent), SECRET)
    expect(event.id).toBe('evt_1')
  })

  it('rejects a header with no v1 signature', async () => {
    await expect(verifyStripeEvent(body, 't=12345', SECRET))
      .rejects.toThrow(/No v1 signature/)
  })

  it('refuses to run when the signing secret is not configured', async () => {
    await expect(verifyStripeEvent(body, await sign(body), ''))
      .rejects.toThrow(/not configured/)
  })

  it('accepts any one of several signatures during a secret rotation', async () => {
    const ts = Math.floor(Date.now() / 1000)
    const good = (await sign(body, SECRET, ts)).split('v1=')[1]
    const header = `t=${ts},v1=deadbeef,v1=${good}`
    const event = await verifyStripeEvent(body, header, SECRET)
    expect(event.id).toBe('evt_1')
  })

  it('rejects a body that is not JSON even when signed', async () => {
    const junk = 'not json at all'
    await expect(verifyStripeEvent(junk, await sign(junk), SECRET))
      .rejects.toThrow(/not valid JSON/)
  })
})
