// ─── Pro Plan Trial ────────────────────────────────────
// Only the Pro plan offers a 7-day free trial.
// Trial state is stored on the user object (user.trialEnd timestamp).
// When migrating to Supabase, trialEnd lives in the profiles table.

const TRIAL_DAYS = 7

export function startTrial(user) {
  if (user.trialEnd) return user // already started
  return {
    ...user,
    plan: "pro",
    trialEnd: Date.now() + (TRIAL_DAYS * 24 * 60 * 60 * 1000),
    trialStarted: Date.now(),
  }
}

export function isTrialActive(user) {
  if (!user?.trialEnd) return false
  return Date.now() < user.trialEnd
}

export function getTrialDaysLeft(user) {
  if (!isTrialActive(user)) return 0
  return Math.ceil((user.trialEnd - Date.now()) / (1000 * 60 * 60 * 24))
}

export function isTrialExpired(user) {
  if (!user?.trialEnd) return false
  return Date.now() >= user.trialEnd
}

// Call this on app load — if trial expired, downgrade to free
export function checkTrialExpiry(user) {
  if (isTrialExpired(user) && user.plan === "pro") {
    return { ...user, plan: "free", trialEnd: null }
  }
  return user
}

export const TRIAL_LENGTH_DAYS = TRIAL_DAYS
