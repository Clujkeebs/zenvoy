// ─── Pro Plan Trial ────────────────────────────────────
//
// `trialEnd` is a TIMESTAMPTZ column, so it arrives from Supabase as an ISO
// string. The previous version compared `Date.now() < user.trialEnd` — a number
// against a string — which coerces to NaN and is therefore always false. The
// visible effect: the trial banner never appeared, and checkTrialExpiry() never
// downgraded anyone. Everything here now goes through one parser.
//
// Trials are started by Stripe (subscription_data[trial_period_days]) and the
// webhook writes trial_end. The client only reads it.

export const TRIAL_LENGTH_DAYS = 7

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Parse whatever `trialEnd` happens to be — ISO string from Postgres, epoch
 * number from an older localStorage record, or a Date.
 *
 * @returns {number|null} epoch milliseconds, or null when absent/unparseable
 */
export function trialEndMs(user) {
  const raw = user?.trialEnd
  if (raw === null || raw === undefined || raw === '') return null

  if (raw instanceof Date) {
    const t = raw.getTime()
    return Number.isFinite(t) ? t : null
  }

  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }

  const parsed = Date.parse(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export function isTrialActive(user, now = Date.now()) {
  const end = trialEndMs(user)
  return end !== null && now < end
}

export function isTrialExpired(user, now = Date.now()) {
  const end = trialEndMs(user)
  return end !== null && now >= end
}

export function getTrialDaysLeft(user, now = Date.now()) {
  const end = trialEndMs(user)
  if (end === null || now >= end) return 0
  return Math.ceil((end - now) / DAY_MS)
}

/**
 * Display-only downgrade. Stripe and the webhook are the source of truth for
 * what a user is actually entitled to; this stops the UI showing Pro features
 * during the gap between a trial lapsing and the webhook landing.
 *
 * It deliberately does not write to the database — the client can't change its
 * own plan any more, and shouldn't be able to.
 */
export function checkTrialExpiry(user, now = Date.now()) {
  if (user?.plan === 'pro' && isTrialExpired(user, now) && !user.stripeSubscriptionId) {
    return { ...user, plan: 'free' }
  }
  return user
}
