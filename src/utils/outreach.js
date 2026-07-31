/* ── outreach.js — the follow-up engine ──────────────────────────────────
 *
 * Most freelance deals don't die from a "no". They die because nobody sent
 * the second email. The app already writes a 5-email sequence; this is what
 * makes the sequence actually happen — it remembers which touch you're on,
 * when you sent it, and when the next one is due.
 *
 * Pure functions over a lead, so the rules are testable and the UI stays dumb.
 * ─────────────────────────────────────────────────────────────────────── */

import { toMs } from './helpers'

const DAY = 86_400_000

/**
 * Day offsets matching the sequence the AI writes in `followup_sequence`.
 * Index 0 is the first contact; the rest are gaps from that first touch.
 */
export const SEQUENCE = [
  { step: 1, label: 'First contact',  dayFromStart: 0,  kind: 'email',
    hint: 'Open with the strongest verified finding.' },
  { step: 2, label: 'Follow-up 1',    dayFromStart: 2,  kind: 'email',
    hint: 'Short nudge. Assume the first mail was missed, not ignored.' },
  { step: 3, label: 'Follow-up 2',    dayFromStart: 5,  kind: 'email',
    hint: 'Give something useful they can act on without hiring you.' },
  { step: 4, label: 'Call attempt',   dayFromStart: 10, kind: 'call',
    hint: 'Email has stalled — a 90-second call converts better here.' },
  { step: 5, label: 'Final follow-up', dayFromStart: 18, kind: 'email',
    hint: 'Close the loop politely. This one gets replies surprisingly often.' },
  { step: 6, label: 'Break-up email', dayFromStart: 30, kind: 'email',
    hint: 'Last touch. Leave the door open and move on.' },
]

export const MAX_STEP = SEQUENCE.length

/** What the lead is on now (0 = never contacted). */
export function currentStep(lead) {
  const n = Number(lead?.outreachStep) || 0
  return Math.max(0, Math.min(n, MAX_STEP))
}

/** The next touch to make, or null when the sequence is exhausted. */
export function nextStep(lead) {
  const step = currentStep(lead)
  if (step >= MAX_STEP) return null
  return SEQUENCE[step]
}

/**
 * When the next touch is due, as an ISO date (yyyy-mm-dd).
 *
 * Measured from the first contact so the whole sequence keeps its shape even
 * if you send one touch late.
 */
export function nextDueDate(lead, now = Date.now()) {
  const next = nextStep(lead)
  if (!next) return null

  const started = toMs(lead?.contactedAt)
  // Never contacted — it's due today.
  if (!started) return isoDate(now)

  return isoDate(started + next.dayFromStart * DAY)
}

/**
 * Record that a touch was made. Returns the lead patch to persist.
 *
 * Advancing the step and scheduling the next one is a single action, because
 * a follow-up you have to remember to schedule is a follow-up you won't make.
 */
export function recordTouch(lead, { kind = 'email', note = '', now = Date.now() } = {}) {
  const step = currentStep(lead)
  const newStep = Math.min(step + 1, MAX_STEP)
  const nowIso = new Date(now).toISOString()

  const patch = {
    outreachStep: newStep,
    lastContactAt: nowIso,
    // First touch starts the clock for the whole sequence.
    contactedAt: lead?.contactedAt || nowIso,
    // Only promote "new" — don't clobber a status you've already set by hand.
    status: lead?.status === 'new' || !lead?.status ? 'contacted' : lead.status,
    outreachLog: [
      ...(Array.isArray(lead?.outreachLog) ? lead.outreachLog : []),
      { step: newStep, kind, at: nowIso, note: String(note || '').slice(0, 200) },
    ].slice(-20),
  }

  patch.followUpDate = nextDueDate({ ...lead, ...patch }, now)
  return patch
}

/** Undo the last touch — for the inevitable misclick. */
export function undoTouch(lead) {
  const step = currentStep(lead)
  if (step === 0) return null

  const log = (Array.isArray(lead?.outreachLog) ? lead.outreachLog : []).slice(0, -1)
  const prevStep = step - 1
  const patch = {
    outreachStep: prevStep,
    outreachLog: log,
    lastContactAt: log.length ? log[log.length - 1].at : null,
    contactedAt: prevStep === 0 ? null : lead.contactedAt,
    status: prevStep === 0 ? 'new' : lead.status,
  }
  patch.followUpDate = prevStep === 0 ? null : nextDueDate({ ...lead, ...patch })
  return patch
}

/** Human summary of where this lead stands. */
export function outreachSummary(lead, now = Date.now()) {
  const step = currentStep(lead)
  if (step === 0) return { label: 'Not contacted', tone: 'lime', overdue: false }
  if (step >= MAX_STEP) return { label: 'Sequence complete', tone: 'muted', overdue: false }

  const due = nextDueDate(lead, now)
  const dueMs = due ? Date.parse(due + 'T00:00:00Z') : null
  const today = Date.parse(isoDate(now) + 'T00:00:00Z')
  const overdue = dueMs !== null && dueMs <= today

  const next = nextStep(lead)
  return {
    label: overdue ? `${next.label} due` : `${next.label} on ${due}`,
    tone: overdue ? 'amber' : 'blue',
    overdue,
    step,
    next,
  }
}

/** Close a deal. Won needs a real number so the analytics mean something. */
export function closeDeal(lead, { won, value, reason, now = Date.now() } = {}) {
  const nowIso = new Date(now).toISOString()
  return {
    status: won ? 'won' : 'lost',
    closedAt: nowIso,
    followUpDate: null,
    wonValue: won ? Math.max(0, Math.round(Number(value) || 0)) : null,
    lostReason: won ? null : String(reason || '').slice(0, 120) || null,
  }
}

export const LOST_REASONS = [
  'No reply',
  'Not interested',
  'Too expensive',
  'Already has someone',
  'Bad timing',
  'Went with a competitor',
  'Business closed',
]

function isoDate(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}
