/* ── notices.js — why to open the desk today ─────────────────────────────
 *
 * Built from stored watch entries and follow-up dates. Dismissals live in
 * the browser until the desk_notices table exists.
 * ─────────────────────────────────────────────────────────────────────── */

const KEY = 'zv_notice_seen'

export function localNotices(leads = [], now = Date.now()) {
  const today = new Date(now).toISOString().slice(0, 10)
  const items = []
  for (const lead of leads) {
    if (!lead || lead.status === 'won' || lead.status === 'lost') continue
    const seen = Date.parse(lead.watchSeenAt || '') || 0
    for (const entry of lead.watchLog || []) {
      const at = Date.parse(entry?.at || '') || 0
      if (at <= seen) continue
      for (const change of entry.changes || []) {
        if (!change?.detail && !change?.label) continue
        items.push({
          id: `watch-${lead.id}-${change.key || change.label}-${entry.at}`,
          kind: 'watch',
          title: `${lead.name}: ${change.label || 'Measured change'}`,
          body: change.detail || change.label,
          leadId: lead.id,
        })
      }
    }
    if (lead.followUpDate && String(lead.followUpDate).slice(0, 10) <= today) {
      items.push({
        id: `follow-${lead.id}-${String(lead.followUpDate).slice(0, 10)}`,
        kind: 'follow_up',
        title: `Follow-up for ${lead.name}`,
        body: `You set ${String(lead.followUpDate).slice(0, 10)}. Nothing has been emailed.`,
        leadId: lead.id,
      })
    }
  }
  return items.slice(0, 8)
}

export function seenNoticeIds() {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')) }
  catch { return new Set() }
}

export function dismissNotice(id) {
  const ids = seenNoticeIds()
  ids.add(id)
  const list = [...ids].slice(-200)
  localStorage.setItem(KEY, JSON.stringify(list))
  return new Set(list)
}
