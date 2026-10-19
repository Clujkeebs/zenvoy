/* ── smokePlan.js — decide whether the live smoke script should run ────── */

export const SMOKE_STEPS = ['sign-in', 'measure', 'save', 'proof', 'recheck', 'desk-agent']

export function smokePlan(env = {}) {
  const url = String(env.SMOKE_SUPABASE_URL || '').trim()
  const key = String(env.SMOKE_SUPABASE_ANON_KEY || '').trim()
  const email = String(env.SMOKE_EMAIL || '').trim()
  const password = String(env.SMOKE_PASSWORD || '')
  const present = [url, key, email, password].filter(Boolean)
  if (present.length === 0) {
    return {
      run: false,
      incomplete: false,
      reason: 'No smoke credentials set. The live check is skipped.',
    }
  }
  const missing = []
  if (!url) missing.push('SMOKE_SUPABASE_URL')
  if (!key) missing.push('SMOKE_SUPABASE_ANON_KEY')
  if (!email) missing.push('SMOKE_EMAIL')
  if (!password) missing.push('SMOKE_PASSWORD')
  if (missing.length) {
    return { run: false, incomplete: true, reason: `Missing ${missing.join(', ')}.` }
  }
  if (!/^https:\/\/[a-z0-9.-]+\.supabase\.co\/?$/i.test(url)) {
    return { run: false, incomplete: true, reason: 'SMOKE_SUPABASE_URL must be an https Supabase project URL.' }
  }
  return {
    run: true,
    incomplete: false,
    url: url.replace(/\/$/, ''),
    key,
    email,
    password,
    site: String(env.SMOKE_SITE || 'https://example.com'),
    steps: SMOKE_STEPS,
  }
}
