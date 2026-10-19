/* ── digest.js — a note for the freelancer, never for a prospect ───────── */

const DAY = 86_400_000

function leadName(lead) {
  return String(lead?.name || 'A saved lead')
}

export function buildDailyDigest(leads = [], now = Date.now(), who = '') {
  const since = now - DAY
  const today = new Date(now).toISOString().slice(0, 10)
  const changes = []
  const followUps = []

  for (const lead of leads) {
    if (!lead || lead.status === 'won' || lead.status === 'lost') continue
    const log = lead.watchLog || lead.watch_log || []
    for (const entry of log) {
      const at = Date.parse(entry?.at || '')
      if (!Number.isFinite(at) || at < since || at > now) continue
      for (const change of entry.changes || []) {
        if (!change?.detail && !change?.label) continue
        changes.push({
          name: leadName(lead),
          text: `${change.label || 'Change'}. ${change.detail || ''}`.replace(/\s+/g, ' ').trim(),
        })
      }
    }
    const due = lead.followUpDate || lead.follow_up_date
    if (due && String(due).slice(0, 10) <= today) {
      followUps.push({ name: leadName(lead), date: String(due).slice(0, 10) })
    }
  }

  if (!changes.length && !followUps.length) return null

  const lines = [who ? `${who}, here is your desk.` : 'Here is your desk.']
  if (changes.length) {
    lines.push(`${changes.length} measured change${changes.length === 1 ? '' : 's'} since yesterday:`)
    for (const change of changes.slice(0, 12)) lines.push(`- ${change.name}: ${change.text}`)
  } else {
    lines.push('No measured change since yesterday.')
  }
  if (followUps.length) {
    lines.push('Follow-ups you dated for today or earlier:')
    for (const item of followUps.slice(0, 12)) lines.push(`- ${item.name} (${item.date})`)
  }
  lines.push('This note is for you. It was not sent to any business.')
  return {
    text: lines.join('\n'),
    changes: changes.length,
    followUps: followUps.length,
  }
}
