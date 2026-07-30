export const scoreColor = s => s >= 75 ? "var(--green)" : s >= 55 ? "var(--lime)" : s >= 35 ? "var(--amber)" : "var(--txt3)"
export const demandColor = s => s >= 70 ? "var(--green)" : s >= 40 ? "var(--amber)" : "var(--red)"
export const fmtMoney = v => v >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + v

/**
 * Leads are timestamped by Postgres, so dates arrive as ISO strings — but older
 * records (and anything still in flight from a scan) can carry an epoch number.
 * Everything date-shaped goes through here so neither form produces
 * "Invalid Date".
 */
export const toMs = v => {
  if (v === null || v === undefined || v === "") return null
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null
  if (typeof v === "number") return Number.isFinite(v) ? v : null
  const parsed = Date.parse(v)
  return Number.isFinite(parsed) ? parsed : null
}

/** When was this lead added? Prefers the DB column, falls back to the legacy one. */
export const leadTime = l => toMs(l?.createdAt) ?? toMs(l?.addedAt) ?? 0

export const fmtDate = ts => {
  const ms = toMs(ts)
  if (ms === null) return "—"
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export const timeAgo = ts => {
  const ms = toMs(ts)
  if (ms === null) return "—"
  const s = Math.floor((Date.now() - ms) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return Math.floor(s / 60) + "m ago"
  if (s < 86400) return Math.floor(s / 3600) + "h ago"
  return Math.floor(s / 86400) + "d ago"
}
export const mkRefCode = email => "ZL-" + email.split("@")[0].slice(0, 4).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()

/** Escape a CSV cell — quotes are doubled, not swapped for apostrophes. */
const csvCell = v => '"' + String(v ?? "").replace(/"/g, '""') + '"'

export function csvExport(leads) {
  const h = [
    "Name", "Type", "Country", "City", "Phone", "Website",
    "Score", "Verified Issues", "Evidence", "Last Audited",
    "Setup Cost", "Monthly Rate", "Monthly Profit", "Status", "Notes", "Added",
  ]
  const rows = leads.map(l => {
    const findings = l.findings || []
    return [
      l.name, l.btype, l.country || "", l.city || "", l.phone || "", l.website || "",
      l.score,
      findings.length,
      // The measured facts, so an exported sheet is still quotable.
      findings.map(f => f.evidence).join(" | "),
      l.auditedAt ? fmtDate(l.auditedAt) : "not audited",
      l.setupCost || "",
      l.myMonthlyRate || l.suggestedMonthlyRate || "",
      (l.myMonthlyRate || l.suggestedMonthlyRate || 0) - (l.toolsCostMonthly || 0),
      l.status || "new",
      l.notes || "",
      fmtDate(l.createdAt ?? l.addedAt),
    ]
  })
  const csv = [h, ...rows].map(r => r.map(csvCell).join(",")).join("\n")
  const a = document.createElement("a")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  a.href = url
  a.download = "leads_" + Date.now() + ".csv"
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
