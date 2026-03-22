export const scoreColor = s => s >= 75 ? "var(--green)" : s >= 55 ? "var(--lime)" : s >= 35 ? "var(--amber)" : "var(--txt3)"
export const demandColor = s => s >= 70 ? "var(--green)" : s >= 40 ? "var(--amber)" : "var(--red)"
export const fmtMoney = v => v >= 1000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + v
export const fmtDate = ts => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
export const timeAgo = ts => {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return "just now"
  if (s < 3600) return Math.floor(s / 60) + "m ago"
  if (s < 86400) return Math.floor(s / 3600) + "h ago"
  return Math.floor(s / 86400) + "d ago"
}
export const mkRefCode = email => "ZL-" + email.split("@")[0].slice(0, 4).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()

export function csvExport(leads) {
  const h = ["Name","Type","Country","City","Phone","Website","Problems","Score","Demand","Competition","Setup Cost","Monthly Rate","Monthly Profit","Status","Notes","Date"]
  const rows = leads.map(l => [
    l.name, l.btype, l.country||"", l.city||"", l.phone||"", l.website||"",
    (l.problems||[]).join("; "), l.score, l.demandScore||"", l.competitionScore||"",
    l.setupCost||"", l.myMonthlyRate||l.suggestedMonthlyRate||"", (l.myMonthlyRate||l.suggestedMonthlyRate||0)-(l.toolsCostMonthly||0), l.status||"new", (l.notes||"").replace(/"/g,"'"), fmtDate(l.addedAt),
  ])
  const csv = [h, ...rows].map(r => r.map(c => "\"" + String(c || "") + "\"").join(",")).join("\n")
  const a = document.createElement("a")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }))
  a.href = url
  a.download = "leads_" + Date.now() + ".csv"
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
