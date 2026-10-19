import { describe, it, expect, vi } from 'vitest'
import { resolveCronSecret } from '../../../supabase/functions/_shared/cronSecret.js'

describe('cron secret fallback', () => {
  it('uses the env value and does not read Vault', async () => {
    const readVault = vi.fn(async () => 'from-vault-value')
    const secret = await resolveCronSecret('from-env-value!!', readVault)
    expect(secret).toBe('from-env-value!!')
    expect(readVault).not.toHaveBeenCalled()
  })

  it('reads Vault when the env value is missing', async () => {
    const secret = await resolveCronSecret('', async () => 'vault-secret-value')
    expect(secret).toBe('vault-secret-value')
  })

  it('returns an empty string when Vault has no text secret', async () => {
    expect(await resolveCronSecret('', async () => null)).toBe('')
    expect(await resolveCronSecret('', async () => { throw new Error('down') })).toBe('')
  })
})
