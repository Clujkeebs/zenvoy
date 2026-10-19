/* Compare the cron header to the secret without short-circuiting on the bytes. */

export function secretsMatch(got, expected) {
  const a = new TextEncoder().encode(String(got ?? ''))
  const b = new TextEncoder().encode(String(expected ?? ''))
  if (a.length < 16 || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}
