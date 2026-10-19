/* The cron header is checked against RECHECK_CRON_SECRET when that env var
 * is set. When it is missing, readVault should return the Vault copy.
 * The compare itself stays in secretsMatch so the bytes are not short-circuited.
 */

export async function resolveCronSecret(envValue, readVault) {
  const fromEnv = String(envValue ?? '')
  if (fromEnv) return fromEnv
  if (typeof readVault !== 'function') return ''
  try {
    const value = await readVault()
    return typeof value === 'string' ? value : ''
  } catch {
    return ''
  }
}
